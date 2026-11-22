begin;

create schema if not exists private;

create table private.catalog_staff (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table private.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null,
  listing_id text not null,
  concentration_id text not null,
  perfume text not null,
  concentration text not null,
  kind text not null check (kind in ('Deduct', 'Correct')),
  before_ml numeric(8, 2) not null check (before_ml >= 0),
  after_ml numeric(8, 2) not null check (after_ml >= 0),
  recorded_at timestamptz not null default clock_timestamp()
);

alter table private.catalog_staff enable row level security;
alter table private.inventory_adjustments enable row level security;
revoke all on table private.catalog_staff, private.inventory_adjustments from public, anon, authenticated;

alter table public.perfumes
  add column revision integer not null default 1,
  add column top_notes text[] not null default '{}',
  add column middle_notes text[] not null default '{}',
  add column base_notes text[] not null default '{}';

create function private.is_catalog_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.catalog_staff where user_id = (select auth.uid()));
$$;

create function private.require_catalog_staff()
returns void
language plpgsql stable set search_path = ''
as $$
begin
  if not private.is_catalog_staff() then
    raise exception using errcode = '42501', message = 'This account does not have staff access.';
  end if;
end;
$$;

create function private.catalog_listing(listing public.perfumes, include_stock boolean)
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', listing.id, 'name', listing.name, 'brand', listing.brand,
    'profile', listing.profile, 'image', listing.image, 'gallery', listing.gallery,
    'description', listing.description, 'gender', listing.gender, 'occasions', listing.occasions,
    'available', listing.available,
    'notes', jsonb_build_array(listing.top_notes, listing.middle_notes, listing.base_notes),
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', variant.id, 'concentration', variant.concentration, 'available', variant.available,
        'description', variant.description, 'images', variant.images,
        'notes', case when cardinality(variant.top_notes) + cardinality(variant.middle_notes)
          + cardinality(variant.base_notes) > 0 then
          jsonb_build_array(variant.top_notes, variant.middle_notes, variant.base_notes) end,
        'sizes', sizes.options
      ) || case when include_stock then jsonb_build_object('remainingMl', variant.remaining_ml)
                else '{}'::jsonb end order by variant.sort_order, variant.id)
      from public.concentration_variants as variant
      cross join lateral (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', size.id, 'ml', size.ml, 'centavos', size.centavos
        ) || case when include_stock then '{}'::jsonb else jsonb_build_object(
          'maxQuantity', case when listing.available and variant.available
            then floor(variant.remaining_ml / size.ml)::integer else 0 end
        ) end order by size.ml), '[]'::jsonb) as options
        from public.decant_sizes as size
        where size.perfume_id = listing.id and size.variant_id = variant.id
      ) as sizes
      where variant.perfume_id = listing.id and (include_stock or sizes.options <> '[]'::jsonb)
    ), '[]'::jsonb)
  ) || case when include_stock then
    jsonb_build_object('revision', listing.revision, 'published', listing.published) else '{}'::jsonb end;
$$;

create or replace function public.get_storefront_catalog()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(entry.details order by listing.sort_order, listing.id), '[]'::jsonb)
  from public.perfumes as listing
  cross join lateral (select private.catalog_listing(listing, false) as details) as entry
  where listing.published and entry.details->'variants' <> '[]'::jsonb;
$$;

create function public.staff_catalog()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_catalog_staff();
  return jsonb_build_object(
    'catalog', coalesce((
      select jsonb_agg(private.catalog_listing(listing, true) order by listing.sort_order, listing.id)
      from public.perfumes as listing
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', adjustment.id, 'staffId', adjustment.staff_id,
        'perfume', adjustment.perfume, 'concentration', adjustment.concentration, 'type', adjustment.kind,
        'before', adjustment.before_ml, 'after', adjustment.after_ml, 'date', adjustment.recorded_at
      ) order by adjustment.recorded_at desc, adjustment.id)
      from (
        select * from private.inventory_adjustments order by recorded_at desc, id limit 100
      ) as adjustment
    ), '[]'::jsonb)
  );
end;
$$;

create function private.catalog_photo_paths(listing_id text)
returns text[]
language sql set search_path = ''
as $$
  select coalesce(array_agg(distinct substr(photo, 9)), '{}')
  from (
    select unnest(array[listing.image] || listing.gallery) as photo
    from public.perfumes as listing where listing.id = listing_id
    union all
    select unnest(variant.images) from public.concentration_variants as variant
    where variant.perfume_id = listing_id
  ) as photos where photo like 'storage:%';
$$;

create function private.can_delete_catalog_photo(object_path text)
returns boolean
language sql security definer set search_path = ''
as $$
  select private.is_catalog_staff()
    and not (object_path = any(private.catalog_photo_paths(split_part(object_path, '/', 1))));
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coast-catalog-uploads', 'coast-catalog-uploads', true, 4194304,
  array['image/jpeg', 'image/png', 'image/webp']);

create policy "Staff can stage catalog photos" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'coast-catalog-uploads'
  and (select private.is_catalog_staff())
  and name ~ '^[a-z0-9]+(-[a-z0-9]+)*/[a-f0-9-]{36}\.(jpg|png|webp)$'
);

create policy "Staff can find catalog uploads" on storage.objects
for select to authenticated
using (bucket_id = 'coast-catalog-uploads' and (select private.is_catalog_staff()));

create policy "Staff can clean up unused catalog uploads" on storage.objects
for delete to authenticated
using (bucket_id = 'coast-catalog-uploads' and private.can_delete_catalog_photo(name));

create function private.editable_catalog_listing(listing_id text, expected_revision integer)
returns public.perfumes
language plpgsql set search_path = ''
as $$
declare
  listing public.perfumes;
begin
  select * into listing from public.perfumes where id = listing_id for update;
  if not found or listing.revision is distinct from expected_revision then
    raise exception 'This listing changed. Refresh the dashboard and reopen it before trying again.';
  end if;
  return listing;
end;
$$;

create function public.staff_save_listing(listing jsonb, expected_revision integer)
returns text[]
language plpgsql security definer set search_path = ''
as $$
declare
  listing_id text := listing->>'id';
  variant jsonb;
  size jsonb;
  variant_id text;
  variant_order integer := 0;
  previous_photos text[] := '{}';
  current_photos text[];
begin
  perform private.require_catalog_staff();
  if nullif(btrim(listing->>'description'), '') is null
      or coalesce(jsonb_array_length(listing->'variants'), 0) = 0
      or exists (
        select 1 from jsonb_array_elements(listing->'variants') as item
        where coalesce(jsonb_array_length(item->'sizes'), 0) = 0
      ) then
    raise exception 'Add a description and at least one priced size for every concentration.';
  end if;

  if expected_revision is not null then
    perform private.editable_catalog_listing(listing_id, expected_revision);
    previous_photos := private.catalog_photo_paths(listing_id);
    update public.perfumes
    set name = listing->>'name', brand = listing->>'brand', profile = listing->>'profile',
        image = listing->>'image', gallery = array(select jsonb_array_elements_text(listing->'gallery')),
        description = listing->>'description', gender = listing->>'gender',
        occasions = array(select jsonb_array_elements_text(listing->'occasions')),
        available = (listing->>'available')::boolean, published = (listing->>'published')::boolean,
        revision = revision + 1,
        top_notes = array(select jsonb_array_elements_text(listing->'notes'->0)),
        middle_notes = array(select jsonb_array_elements_text(listing->'notes'->1)),
        base_notes = array(select jsonb_array_elements_text(listing->'notes'->2))
    where id = listing_id;
  else
    insert into public.perfumes (
      id, name, brand, profile, image, gallery, description, gender, occasions,
      available, published, top_notes, middle_notes, base_notes
    ) values (
      listing_id, listing->>'name', listing->>'brand', listing->>'profile', listing->>'image',
      array(select jsonb_array_elements_text(listing->'gallery')), listing->>'description', listing->>'gender',
      array(select jsonb_array_elements_text(listing->'occasions')), (listing->>'available')::boolean, true,
      array(select jsonb_array_elements_text(listing->'notes'->0)),
      array(select jsonb_array_elements_text(listing->'notes'->1)),
      array(select jsonb_array_elements_text(listing->'notes'->2))
    ) on conflict (id) do nothing;
    if not found then
      raise exception 'A listing with this address already exists. Refresh the dashboard before adding it.';
    end if;
  end if;

  delete from public.concentration_variants as existing
  where existing.perfume_id = listing_id and not exists (
    select 1 from jsonb_array_elements(listing->'variants') as item where item->>'id' = existing.id
  );

  for variant in select value from jsonb_array_elements(listing->'variants') loop
    variant_id := variant->>'id';
    variant_order := variant_order + 1;
    insert into public.concentration_variants (
      perfume_id, id, concentration, top_notes, middle_notes, base_notes,
      description, images, available, remaining_ml, sort_order
    ) values (
      listing_id, variant_id, variant->>'concentration',
      array(select jsonb_array_elements_text(nullif(variant->'notes'->0, 'null'::jsonb))),
      array(select jsonb_array_elements_text(nullif(variant->'notes'->1, 'null'::jsonb))),
      array(select jsonb_array_elements_text(nullif(variant->'notes'->2, 'null'::jsonb))),
      nullif(variant->>'description', ''), array(select jsonb_array_elements_text(nullif(variant->'images', 'null'::jsonb))),
      (variant->>'available')::boolean, (variant->>'remainingMl')::numeric, variant_order
    ) on conflict (perfume_id, id) do update set
      top_notes = excluded.top_notes, middle_notes = excluded.middle_notes, base_notes = excluded.base_notes,
      description = excluded.description, images = excluded.images, available = excluded.available,
      sort_order = excluded.sort_order
    where public.concentration_variants.concentration = excluded.concentration;
    if not found then
      raise exception 'Remove the old concentration and add a new one to change its type.';
    end if;

    delete from public.decant_sizes as existing
    where existing.perfume_id = listing_id and existing.variant_id = variant->>'id' and not exists (
      select 1 from jsonb_array_elements(variant->'sizes') as item where item->>'id' = existing.id
    );
    for size in select value from jsonb_array_elements(variant->'sizes') loop
      insert into public.decant_sizes (perfume_id, variant_id, id, ml, centavos)
      values (listing_id, variant_id, size->>'id', (size->>'ml')::numeric, (size->>'centavos')::integer)
      on conflict on constraint decant_sizes_pkey do update set centavos = excluded.centavos
      where public.decant_sizes.ml = excluded.ml;
      if not found then
        raise exception 'A replacement size requires its own ID.';
      end if;
    end loop;
  end loop;

  current_photos := private.catalog_photo_paths(listing_id);
  if exists (
    select 1 from unnest(current_photos) as path
    where split_part(path, '/', 1) <> listing_id or not exists (
      select 1 from storage.objects where bucket_id = 'coast-catalog-uploads' and name = path
    )
  ) then
    raise exception 'A listing photo is missing. Choose the photo again and retry.';
  end if;
  return array(select path from unnest(previous_photos) as path where not (path = any(current_photos)));
end;
$$;

create function public.staff_set_availability(
  listing_id text, concentration_id text, enabled boolean, expected_revision integer
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_catalog_staff();
  perform private.editable_catalog_listing(listing_id, expected_revision);
  if concentration_id is null then
    update public.perfumes set available = enabled, revision = revision + 1 where id = listing_id;
  else
    update public.concentration_variants set available = enabled
    where perfume_id = listing_id and id = concentration_id;
    if not found then
      raise exception 'This concentration was removed. Refresh the dashboard.';
    end if;
    update public.perfumes set revision = revision + 1 where id = listing_id;
  end if;
end;
$$;

create function public.staff_change_stock(
  listing_id text, concentration_id text, adjustment_kind text, volume numeric, expected_volume numeric,
  expected_revision integer, adjustment_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  listing_name text;
  listing_revision integer;
  variant public.concentration_variants;
  previous_adjustment private.inventory_adjustments;
  after_ml numeric;
begin
  perform private.require_catalog_staff();
  if adjustment_id is null or adjustment_kind is null or adjustment_kind not in ('Deduct', 'Correct')
      or volume is null or not (volume between 0 and 999999.99) or volume <> round(volume, 2)
      or (adjustment_kind = 'Deduct' and volume = 0) then
    raise exception 'Enter a valid volume with up to two decimal places.';
  end if;
  select name, revision into listing_name, listing_revision from public.perfumes where id = listing_id for update;
  if not found then
    raise exception 'This listing was removed. Refresh the dashboard.';
  end if;
  select * into previous_adjustment from private.inventory_adjustments where id = adjustment_id;
  if found then
    if previous_adjustment.staff_id = auth.uid() and previous_adjustment.listing_id = listing_id
        and previous_adjustment.concentration_id = concentration_id and previous_adjustment.kind = adjustment_kind
        and volume = (case when adjustment_kind = 'Deduct'
          then previous_adjustment.before_ml - previous_adjustment.after_ml else previous_adjustment.after_ml end) then
      return;
    end if;
    raise exception 'This stock adjustment ID has already been used.';
  end if;
  select * into variant from public.concentration_variants
  where perfume_id = listing_id and id = concentration_id for update;
  if not found then
    raise exception 'This concentration was removed. Refresh the dashboard.';
  end if;
  if adjustment_kind = 'Correct' and (variant.remaining_ml is distinct from expected_volume
      or listing_revision is distinct from expected_revision) then
    raise exception 'Stock changed. Refresh the dashboard before correcting the count.';
  end if;
  after_ml := case when adjustment_kind = 'Deduct' then variant.remaining_ml - volume else volume end;
  if after_ml < 0 then
    raise exception 'The deduction exceeds the recorded volume.';
  end if;
  update public.concentration_variants set remaining_ml = after_ml
  where perfume_id = listing_id and id = concentration_id;
  update public.perfumes set revision = revision + 1 where id = listing_id;
  insert into private.inventory_adjustments (
    id, staff_id, listing_id, concentration_id, perfume, concentration, kind, before_ml, after_ml
  ) values (
    adjustment_id, auth.uid(), listing_id, concentration_id, listing_name, variant.concentration,
    adjustment_kind, variant.remaining_ml, after_ml
  );
end;
$$;

create function public.staff_delete_listing(listing_id text, expected_revision integer)
returns text[]
language plpgsql security definer set search_path = ''
as $$
declare
  old_photos text[];
begin
  perform private.require_catalog_staff();
  perform private.editable_catalog_listing(listing_id, expected_revision);
  old_photos := private.catalog_photo_paths(listing_id);
  delete from public.perfumes where id = listing_id;
  return old_photos;
end;
$$;

revoke all on function private.is_catalog_staff(), private.require_catalog_staff(),
  private.catalog_listing(public.perfumes, boolean), private.catalog_photo_paths(text),
  private.can_delete_catalog_photo(text), private.editable_catalog_listing(text, integer)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_catalog_staff(), private.can_delete_catalog_photo(text) to authenticated;

revoke all on function public.get_storefront_catalog(), public.staff_catalog(),
  public.staff_save_listing(jsonb, integer), public.staff_set_availability(text, text, boolean, integer),
  public.staff_change_stock(text, text, text, numeric, numeric, integer, uuid), public.staff_delete_listing(text, integer)
  from public, anon, authenticated;
grant execute on function public.get_storefront_catalog() to anon, authenticated;
grant execute on function public.staff_catalog(), public.staff_save_listing(jsonb, integer),
  public.staff_set_availability(text, text, boolean, integer),
  public.staff_change_stock(text, text, text, numeric, numeric, integer, uuid), public.staff_delete_listing(text, integer)
  to authenticated;

commit;

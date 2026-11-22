begin;

alter table public.perfumes alter column description set default '';

create or replace function public.staff_save_listing(listing jsonb, expected_revision integer)
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
  if coalesce(jsonb_array_length(listing->'variants'), 0) = 0
      or exists (
        select 1 from jsonb_array_elements(listing->'variants') as item
        where coalesce(jsonb_array_length(item->'sizes'), 0) = 0
      ) then
    raise exception 'Add at least one concentration with a priced size for each.';
  end if;

  if expected_revision is not null then
    perform private.editable_catalog_listing(listing_id, expected_revision);
    previous_photos := private.catalog_photo_paths(listing_id);
    update public.perfumes
    set name = listing->>'name', brand = listing->>'brand', profile = listing->>'profile',
        image = listing->>'image', gallery = array(select jsonb_array_elements_text(listing->'gallery')),
        description = coalesce(listing->>'description', ''), gender = listing->>'gender',
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
      array(select jsonb_array_elements_text(listing->'gallery')), coalesce(listing->>'description', ''), listing->>'gender',
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

commit;


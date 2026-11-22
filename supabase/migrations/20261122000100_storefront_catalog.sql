begin;

create table public.perfumes (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (btrim(name) <> ''),
  brand text not null check (btrim(brand) <> ''),
  profile text not null check (profile in ('Fresh', 'Citrus', 'Floral', 'Woody')),
  image text not null check (btrim(image) <> ''),
  gallery text[] not null default '{}',
  description text not null,
  gender text not null check (gender in ('Unisex', 'Feminine', 'Masculine')),
  occasions text[] not null default '{}',
  published boolean not null default false,
  available boolean not null default true,
  sort_order integer not null default 0
);

create table public.concentration_variants (
  perfume_id text not null references public.perfumes (id) on delete cascade,
  id text not null check (btrim(id) <> ''),
  concentration text not null check (concentration in ('EDT', 'EDP', 'Extrait')),
  top_notes text[] not null default '{}',
  middle_notes text[] not null default '{}',
  base_notes text[] not null default '{}',
  description text,
  images text[] not null default '{}',
  available boolean not null default true,
  remaining_ml numeric(8, 2) not null check (remaining_ml between 0 and 999999.99),
  sort_order integer not null default 0,
  primary key (perfume_id, id),
  unique (perfume_id, concentration)
);

create table public.decant_sizes (
  perfume_id text not null,
  variant_id text not null,
  id text not null check (btrim(id) <> ''),
  ml numeric(8, 2) not null check (ml between 0.01 and 999999.99),
  centavos integer not null check (centavos > 0),
  primary key (perfume_id, variant_id, id),
  unique (perfume_id, variant_id, ml),
  foreign key (perfume_id, variant_id)
    references public.concentration_variants (perfume_id, id) on delete cascade
);

alter table public.perfumes enable row level security;
alter table public.concentration_variants enable row level security;
alter table public.decant_sizes enable row level security;
revoke all on table public.perfumes, public.concentration_variants, public.decant_sizes
  from public, anon, authenticated;

insert into public.perfumes
  (id, name, brand, profile, image, description, gender, occasions, published, available, sort_order)
values
  ('saltwater-linen', 'Saltwater Linen', 'Maison Marea', 'Fresh', 'fresh',
   'Sea salt and bright bergamot settle into airy cypress and dry cedarwood.',
   'Unisex', array['Everyday', 'Office'], true, true, 1),
  ('citrus-tide', 'Citrus Tide', 'Isla Atelier', 'Citrus', 'citrus',
   'A crisp opening of grapefruit and bergamot softens into neroli and white musk.',
   'Unisex', array['Everyday', 'Office'], true, true, 2),
  ('petal-mist', 'Petal Mist', 'Atelier Virelle', 'Floral', 'floral',
   'Juicy pear and pink pepper lift an iris and jasmine heart over soft sandalwood.',
   'Unisex', array['Date night', 'Special occasion'], true, true, 3),
  ('amber-drift', 'Amber Drift', 'Maison Marea', 'Woody', 'woody',
   'Cardamom warms a base of amber, cedarwood, and vanilla.',
   'Masculine', array['Date night', 'Special occasion'], true, true, 4),
  ('clearwater', 'Clearwater', 'Isla Atelier', 'Fresh', 'fresh',
   'Cool mint and green tea with a transparent sea salt finish.',
   'Unisex', array['Everyday'], true, true, 5),
  ('dusk-jasmine', 'Dusk Jasmine', 'Atelier Virelle', 'Floral', 'floral',
   'Jasmine and orange blossom deepen into vanilla and amber.',
   'Feminine', array['Special occasion'], true, false, 6);

insert into public.concentration_variants
  (perfume_id, id, concentration, top_notes, middle_notes, base_notes, remaining_ml, sort_order)
values
  ('saltwater-linen', 'edp', 'EDP', array['Sea salt', 'Bergamot'], array['Cypress', 'Clary sage'], array['Cedarwood', 'Vetiver'], 7, 1),
  ('saltwater-linen', 'edt', 'EDT', array['Bergamot', 'Lemon'], array['Cypress'], array['Cedarwood'], 24, 2),
  ('citrus-tide', 'edt', 'EDT', array['Grapefruit', 'Bergamot'], array['Neroli', 'Green tea'], array['White musk'], 24, 1),
  ('petal-mist', 'extrait', 'Extrait', array['Pear', 'Pink pepper'], array['Iris', 'Jasmine'], array['White musk', 'Sandalwood'], 24, 1),
  ('amber-drift', 'edp', 'EDP', array['Cardamom', 'Black pepper'], array['Cedarwood'], array['Amber', 'Vanilla'], 24, 1),
  ('clearwater', 'edt', 'EDT', array['Mint', 'Lemon'], array['Green tea'], array['Sea salt', 'White musk'], 24, 1),
  ('dusk-jasmine', 'edp', 'EDP', array['Orange blossom'], array['Jasmine', 'Iris'], array['Amber', 'Vanilla'], 24, 1);

insert into public.decant_sizes (perfume_id, variant_id, id, ml, centavos)
select seed.perfume_id, seed.variant_id, size.ml::text, size.ml, size.centavos
from (values
  ('saltwater-linen', 'edp', 14900, 29500, 52000),
  ('saltwater-linen', 'edt', 12900, 25500, 43000),
  ('citrus-tide', 'edt', 11900, 23900, 42900),
  ('petal-mist', 'extrait', 18500, 34000, 64500),
  ('amber-drift', 'edp', 15900, 30500, 55000),
  ('clearwater', 'edt', 12900, 25000, 44500),
  ('dusk-jasmine', 'edp', 16900, 32500, 59000)
) as seed(perfume_id, variant_id, price_2ml, price_5ml, price_10ml)
cross join lateral (values
  (2, seed.price_2ml), (5, seed.price_5ml), (10, seed.price_10ml)
) as size(ml, centavos);

-- Only the explicitly selected storefront fields cross the public API boundary.
create function public.get_storefront_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', perfume.id,
    'name', perfume.name,
    'brand', perfume.brand,
    'profile', perfume.profile,
    'image', perfume.image,
    'gallery', perfume.gallery,
    'description', perfume.description,
    'gender', perfume.gender,
    'occasions', perfume.occasions,
    'available', perfume.available,
    'variants', listing.variants
  ) order by perfume.sort_order, perfume.id), '[]'::jsonb)
  from public.perfumes as perfume
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', variant.id,
      'concentration', variant.concentration,
      'notes', jsonb_build_array(variant.top_notes, variant.middle_notes, variant.base_notes),
      'description', variant.description,
      'images', variant.images,
      'available', variant.available,
      'sizes', sizes.options
    ) order by variant.sort_order, variant.id) as variants
    from public.concentration_variants as variant
    cross join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', decant.id,
        'ml', decant.ml,
        'centavos', decant.centavos,
        'maxQuantity', case when perfume.available and variant.available
          then floor(variant.remaining_ml / decant.ml)::integer else 0 end
      ) order by decant.ml) as options
      from public.decant_sizes as decant
      where decant.perfume_id = variant.perfume_id and decant.variant_id = variant.id
    ) as sizes
    where variant.perfume_id = perfume.id and sizes.options is not null
  ) as listing
  where perfume.published and listing.variants is not null;
$$;

revoke all on function public.get_storefront_catalog() from public, anon, authenticated;
grant execute on function public.get_storefront_catalog() to anon, authenticated;

commit;

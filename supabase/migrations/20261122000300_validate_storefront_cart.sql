begin;

create function public.validate_storefront_cart(cart_lines jsonb, selected_perfume_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(cart_lines) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Provide the cart as an array.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(cart_lines) as entry(line)
    where jsonb_typeof(line->'perfumeId') is distinct from 'string'
      or jsonb_typeof(line->'variantId') is distinct from 'string'
      or jsonb_typeof(line->'sizeId') is distinct from 'string'
      or case when jsonb_typeof(line->'quantity') = 'number' then
        (line->>'quantity')::numeric < 1
        or (line->>'quantity')::numeric <> trunc((line->>'quantity')::numeric)
      else true end
  ) then
    raise exception using errcode = '22023', message = 'Each cart line needs item IDs and a positive whole quantity.';
  end if;

  return (
    with requested as (
      select "perfumeId" as perfume_id, "variantId" as variant_id, "sizeId" as size_id,
        sum(quantity) as quantity
      from jsonb_to_recordset(cart_lines) as line("perfumeId" text, "variantId" text, "sizeId" text, quantity numeric)
      group by "perfumeId", "variantId", "sizeId"
    ), listed as (
      select listing as perfume, listing.id, listing.sort_order, listing.available
      from public.perfumes as listing
      where listing.published and (listing.id = selected_perfume_id or exists (
        select 1 from requested where requested.perfume_id = listing.id
      ))
    ), used as (
      select requested.perfume_id, requested.variant_id, sum(requested.quantity * size.ml) as ml
      from requested
      join public.decant_sizes as size
        on (size.perfume_id, size.variant_id, size.id) = (requested.perfume_id, requested.variant_id, requested.size_id)
      group by requested.perfume_id, requested.variant_id
    ), limits as (
      select listing.id as perfume_id, variant.id as variant_id, size.id as size_id,
        case when listing.available and variant.available then
          greatest(0, floor((variant.remaining_ml - coalesce(used.ml, 0)
            + coalesce(requested.quantity, 0) * size.ml) / size.ml))::integer
        else 0 end as max_quantity
      from listed as listing
      join public.concentration_variants as variant on variant.perfume_id = listing.id
      join public.decant_sizes as size on (size.perfume_id, size.variant_id) = (listing.id, variant.id)
      left join used on (used.perfume_id, used.variant_id) = (listing.id, variant.id)
      left join requested on (requested.perfume_id, requested.variant_id, requested.size_id) =
        (listing.id, variant.id, size.id)
    )
    select jsonb_build_object(
      'catalog', coalesce((
        select jsonb_agg(entry.details order by listing.sort_order, listing.id)
        from listed as listing
        cross join lateral (select private.catalog_listing(listing.perfume, false) as details) as entry
        where entry.details->'variants' <> '[]'::jsonb
      ), '[]'::jsonb),
      'limits', coalesce((
        select jsonb_agg(jsonb_build_object(
          'perfumeId', perfume_id, 'variantId', variant_id, 'sizeId', size_id, 'maxQuantity', max_quantity
        ))
        from limits
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.validate_storefront_cart(jsonb, text) from public, anon, authenticated;
grant execute on function public.validate_storefront_cart(jsonb, text) to anon, authenticated;

commit;

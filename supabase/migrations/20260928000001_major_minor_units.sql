-- Marg-style major/minor unit flags. Stock remains in minor (base) units.
-- pack_unit = major/purchase unit, unit = minor/sale unit, units_per_pack = packing.

alter table public.products
  add column if not exists allow_pack_purchase boolean not null default true,
  add column if not exists fixed_packing boolean not null default true;

# Product packaging and POS unit/qty

## What changed
- Product master now has configurable packaging: base unit, pack unit, units per pack, min/max sale qty, allow base sale, allow pack sale.
- Stock ledger stays in base units. Purchase and POS convert the selected unit to base quantity before stock IN/OUT.
- POS cart is Product | Batch | Available | Unit | Qty | MRP | Price | Discount | Tax | Amount.
- Batch selection is independent of quantity. Available shows base-unit stock, not sale qty.
- Oversell is rejected as `Only 14 PCS available.` GST still uses commercial sale qty and sale price. MRP is unchanged.

## Conversion
- Base qty 1 = 1 base unit.
- Pack qty 1 = `unitsPerPack` base units.
- Purchase can receive packs even when pack sale is off.
- Pack size is not min/max sale qty.

## Schema
- Migration `supabase/migrations/20260923000000_product_packaging.sql`
  - `products.pack_unit`, `pack_unit_id`, `units_per_pack`, `min_sale_qty`, `max_sale_qty`, `allow_base_sale`, `allow_pack_sale`
  - invoice items `sale_unit` and `base_quantity` (commercial qty stays on `quantity`)

## Verification
- 140 tests, lint, `tsc --noEmit`, `next build` green.

## Not started
- CHECKLIST Resume from remains **P4-5** (printable/PDF invoice).

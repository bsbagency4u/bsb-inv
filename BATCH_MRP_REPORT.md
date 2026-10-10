# Batch MRP auto-load (purchase to POS)

## What changed
- Purchase can record batch no, expiry, and MRP when the business type shows those fields.
- Receiving a bill creates/updates `product_batches` and stocks IN with that `batch_id` and warehouse.
- POS/sales invoice auto-loads read-only MRP from the on-hand lot (batch MRP, then variant, then product).
- Completing a sale stocks OUT from the same selected batch/warehouse.
- GST still uses sale price (taxable amount), never MRP.
- Sale price cannot exceed MRP when MRP is present.

## MRP source order
1. Selected `product_batches.mrp`
2. Variant MRP
3. Product master MRP

## UI
- Batch/expiry/MRP on purchase and POS only when `businessTracksBatches` / `businessShowsMrp` is true (attribute registry, not hardcoded type strings).
- POS MRP is display-only; cashier picks a lot (FEFO then FIFO). Barcode add uses the first sellable lot.

## Schema
- Migration `supabase/migrations/20260921000000_batch_mrp_stock.sql`
  - `product_batches.purchase_price`
  - `stock_balances` grouped by `batch_id`
  - members (not only owners) can insert/update batches
- Reuses existing `product_batches.mrp` and invoice `batch_id` columns. No new MRP table.

## Not started
- CHECKLIST Resume from remains **P4-5** (printable/PDF invoice).

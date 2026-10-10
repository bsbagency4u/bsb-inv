-- Members with purchase access must be able to increment received_quantity
-- and flip order status (confirmed -> partial -> received) without being owners.

drop policy if exists "owners can update purchase orders" on public.purchase_orders;
create policy "members can update purchase orders"
  on public.purchase_orders for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

drop policy if exists "owners can update purchase order items" on public.purchase_order_items;
create policy "members can update purchase order items"
  on public.purchase_order_items for update
  to authenticated
  using (is_business_member(
    (select business_id from public.purchase_orders where id = purchase_order_id)
  ))
  with check (is_business_member(
    (select business_id from public.purchase_orders where id = purchase_order_id)
  ));

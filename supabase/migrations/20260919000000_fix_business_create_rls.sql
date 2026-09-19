-- ============================================================================
-- BSB StockFlow — Allow creators to read a business on INSERT RETURNING
--
-- INSERT ... RETURNING applies SELECT policies before AFTER INSERT triggers
-- run, so is_business_member(id) is still false and onboarding save fails.
-- Creators may select rows they just inserted (created_by = auth.uid()).
-- Existing member/owner policies stay in place (permissive policies OR).
-- ============================================================================

drop policy if exists "creators can view their new businesses" on public.businesses;
create policy "creators can view their new businesses"
  on public.businesses for select
  to authenticated
  using (created_by = auth.uid());

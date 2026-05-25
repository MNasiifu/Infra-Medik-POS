-- ============================================================
-- INFRA MEDIK POS — Migration 019: Catalog reference access
-- • Add is_active to countries (soft-delete parity)
-- • RLS: all roles read; admin/manager/teller insert & update;
--   tellers cannot deactivate (is_active must stay true on update);
--   only admin/manager may hard-delete rows
-- ============================================================

alter table countries
  add column if not exists is_active boolean not null default true;

update countries set is_active = true where is_active is null;

-- ─── Helper ──────────────────────────────────────────────────
create or replace function is_teller()
returns boolean
language sql
security definer stable
as $$
  select role = 'teller' from profiles where id = auth.uid()
$$;

-- ─── Drop legacy write policies ──────────────────────────────
drop policy if exists "countries: admin write" on countries;
drop policy if exists "categories: admin/manager write" on categories;
drop policy if exists "manufacturers: admin/manager write" on manufacturers;
drop policy if exists "suppliers: admin/manager write" on suppliers;

-- ════════════════════════════════════════════════════════════
-- COUNTRIES
-- ════════════════════════════════════════════════════════════

create policy "countries: staff insert"
  on countries for insert to authenticated
  with check (true);

create policy "countries: admin/manager update"
  on countries for update to authenticated
  using (is_admin_or_manager())
  with check (is_admin_or_manager());

create policy "countries: teller update"
  on countries for update to authenticated
  using (is_teller())
  with check (is_teller() and is_active = true);

create policy "countries: admin/manager delete"
  on countries for delete to authenticated
  using (is_admin_or_manager());

-- ════════════════════════════════════════════════════════════
-- CATEGORIES
-- ════════════════════════════════════════════════════════════

create policy "categories: staff insert"
  on categories for insert to authenticated
  with check (true);

create policy "categories: admin/manager update"
  on categories for update to authenticated
  using (is_admin_or_manager())
  with check (is_admin_or_manager());

create policy "categories: teller update"
  on categories for update to authenticated
  using (is_teller())
  with check (is_teller() and is_active = true);

create policy "categories: admin/manager delete"
  on categories for delete to authenticated
  using (is_admin_or_manager());

-- ════════════════════════════════════════════════════════════
-- MANUFACTURERS
-- ════════════════════════════════════════════════════════════

create policy "manufacturers: staff insert"
  on manufacturers for insert to authenticated
  with check (true);

create policy "manufacturers: admin/manager update"
  on manufacturers for update to authenticated
  using (is_admin_or_manager())
  with check (is_admin_or_manager());

create policy "manufacturers: teller update"
  on manufacturers for update to authenticated
  using (is_teller())
  with check (is_teller() and is_active = true);

create policy "manufacturers: admin/manager delete"
  on manufacturers for delete to authenticated
  using (is_admin_or_manager());

-- ════════════════════════════════════════════════════════════
-- SUPPLIERS
-- ════════════════════════════════════════════════════════════

create policy "suppliers: staff insert"
  on suppliers for insert to authenticated
  with check (true);

create policy "suppliers: admin/manager update"
  on suppliers for update to authenticated
  using (is_admin_or_manager())
  with check (is_admin_or_manager());

create policy "suppliers: teller update"
  on suppliers for update to authenticated
  using (is_teller())
  with check (is_teller() and is_active = true);

create policy "suppliers: admin/manager delete"
  on suppliers for delete to authenticated
  using (is_admin_or_manager());

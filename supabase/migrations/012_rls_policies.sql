-- ============================================================
-- INFRA MEDIK POS — Migration 012: Row Level Security Policies
-- Run after 011
-- ============================================================
-- Pattern:
--   • Admin  → all rows across all branches
--   • Manager/Teller → own branch only
--   • Teller → read-only on most tables; can write sales/payments/customers/delivery_orders
-- ============================================================

-- Enable RLS on all tables
alter table branches                  enable row level security;
alter table countries                 enable row level security;
alter table categories                enable row level security;
alter table manufacturers             enable row level security;
alter table suppliers                 enable row level security;
alter table profiles                  enable row level security;
alter table products                  enable row level security;
alter table product_units             enable row level security;
alter table product_barcodes          enable row level security;
alter table stock_batches             enable row level security;
alter table stock_adjustments         enable row level security;
alter table stock_takes               enable row level security;
alter table stock_take_items          enable row level security;
alter table purchase_orders           enable row level security;
alter table purchase_order_items      enable row level security;
alter table stock_receivings          enable row level security;
alter table stock_receiving_items     enable row level security;
alter table customers                 enable row level security;
alter table delivery_orders           enable row level security;
alter table delivery_order_items      enable row level security;
alter table sales                     enable row level security;
alter table sale_items                enable row level security;
alter table payments                  enable row level security;
alter table returns                   enable row level security;
alter table return_items              enable row level security;
alter table vat_rates                 enable row level security;
alter table vat_exempt_overrides      enable row level security;
alter table daily_reconciliations     enable row level security;
alter table reconciliation_denominations enable row level security;
alter table efris_submissions         enable row level security;
alter table audit_logs                enable row level security;

-- ════════════════════════════════════════════════════════════
-- GLOBAL REFERENCE TABLES (all authenticated users can read)
-- ════════════════════════════════════════════════════════════

-- branches
create policy "branches: authenticated read"
  on branches for select to authenticated
  using (true);
create policy "branches: admin write"
  on branches for all to authenticated
  using (is_admin()) with check (is_admin());

-- countries
create policy "countries: authenticated read"
  on countries for select to authenticated using (true);
create policy "countries: admin write"
  on countries for all to authenticated
  using (is_admin()) with check (is_admin());

-- categories
create policy "categories: authenticated read"
  on categories for select to authenticated using (true);
create policy "categories: admin/manager write"
  on categories for all to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- manufacturers
create policy "manufacturers: authenticated read"
  on manufacturers for select to authenticated using (true);
create policy "manufacturers: admin/manager write"
  on manufacturers for all to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- suppliers
create policy "suppliers: authenticated read"
  on suppliers for select to authenticated using (true);
create policy "suppliers: admin/manager write"
  on suppliers for all to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- vat_rates
create policy "vat_rates: authenticated read"
  on vat_rates for select to authenticated using (true);
create policy "vat_rates: admin write"
  on vat_rates for all to authenticated
  using (is_admin()) with check (is_admin());

-- vat_exempt_overrides
create policy "vat_exempt: authenticated read"
  on vat_exempt_overrides for select to authenticated using (true);
create policy "vat_exempt: admin write"
  on vat_exempt_overrides for all to authenticated
  using (is_admin()) with check (is_admin());

-- ════════════════════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════════════════════

-- Users can read their own profile; admin reads all
create policy "profiles: own read"
  on profiles for select to authenticated
  using (id = auth.uid() or is_admin());

-- Only admin can create profiles (done via RPC)
create policy "profiles: admin insert"
  on profiles for insert to authenticated
  with check (is_admin());

-- Admin can update any; users can update their own (limited fields via RPC)
create policy "profiles: admin or own update"
  on profiles for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- Only admin can deactivate (no hard deletes)
create policy "profiles: admin delete"
  on profiles for delete to authenticated
  using (is_admin());

-- ════════════════════════════════════════════════════════════
-- PRODUCTS
-- ════════════════════════════════════════════════════════════

create policy "products: authenticated read"
  on products for select to authenticated
  using (deleted_at is null or is_admin_or_manager());

create policy "products: admin/manager write"
  on products for insert to authenticated
  with check (is_admin_or_manager());

create policy "products: admin/manager update"
  on products for update to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- No hard deletes; soft delete via update
create policy "products: admin/manager delete"
  on products for delete to authenticated
  using (is_admin());

-- product_units
create policy "product_units: authenticated read"
  on product_units for select to authenticated using (true);
create policy "product_units: admin/manager write"
  on product_units for all to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- product_barcodes
create policy "product_barcodes: authenticated read"
  on product_barcodes for select to authenticated using (true);
create policy "product_barcodes: admin/manager write"
  on product_barcodes for all to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- ════════════════════════════════════════════════════════════
-- INVENTORY (branch-scoped)
-- ════════════════════════════════════════════════════════════

-- stock_batches
create policy "stock_batches: branch read"
  on stock_batches for select to authenticated
  using (is_admin() or branch_id = get_user_branch_id());
create policy "stock_batches: admin/manager write"
  on stock_batches for all to authenticated
  using (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()))
  with check (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()));

-- stock_adjustments
create policy "stock_adjustments: branch read"
  on stock_adjustments for select to authenticated
  using (is_admin() or branch_id = get_user_branch_id());
create policy "stock_adjustments: admin/manager insert"
  on stock_adjustments for insert to authenticated
  with check (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()));

-- stock_takes
create policy "stock_takes: branch read"
  on stock_takes for select to authenticated
  using (is_admin() or branch_id = get_user_branch_id());
create policy "stock_takes: admin/manager write"
  on stock_takes for all to authenticated
  using (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()))
  with check (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()));

-- stock_take_items
create policy "stock_take_items: via stock_take read"
  on stock_take_items for select to authenticated
  using (
    exists (
      select 1 from stock_takes st
      where st.id = stock_take_id
        and (is_admin() or st.branch_id = get_user_branch_id())
    )
  );
create policy "stock_take_items: admin/manager write"
  on stock_take_items for all to authenticated
  using (is_admin_or_manager())
  with check (is_admin_or_manager());

-- purchase_orders
create policy "purchase_orders: branch read"
  on purchase_orders for select to authenticated
  using (is_admin() or branch_id = get_user_branch_id());
create policy "purchase_orders: admin/manager write"
  on purchase_orders for all to authenticated
  using (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()))
  with check (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()));

-- purchase_order_items
create policy "po_items: via po read"
  on purchase_order_items for select to authenticated
  using (
    exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_id
        and (is_admin() or po.branch_id = get_user_branch_id())
    )
  );
create policy "po_items: admin/manager write"
  on purchase_order_items for all to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- stock_receivings
create policy "stock_receivings: branch read"
  on stock_receivings for select to authenticated
  using (is_admin() or branch_id = get_user_branch_id());
create policy "stock_receivings: admin/manager write"
  on stock_receivings for all to authenticated
  using (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()))
  with check (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()));

-- stock_receiving_items
create policy "receiving_items: via receiving read"
  on stock_receiving_items for select to authenticated
  using (
    exists (
      select 1 from stock_receivings sr
      where sr.id = receiving_id
        and (is_admin() or sr.branch_id = get_user_branch_id())
    )
  );
create policy "receiving_items: admin/manager write"
  on stock_receiving_items for all to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- ════════════════════════════════════════════════════════════
-- CUSTOMERS & DELIVERIES
-- ════════════════════════════════════════════════════════════

-- customers (all roles can read and manage)
create policy "customers: authenticated read"
  on customers for select to authenticated
  using (deleted_at is null);
create policy "customers: authenticated write"
  on customers for insert to authenticated
  with check (true);
create policy "customers: authenticated update"
  on customers for update to authenticated
  using (true) with check (true);
create policy "customers: admin/manager soft-delete"
  on customers for delete to authenticated
  using (is_admin_or_manager());

-- delivery_orders
create policy "delivery_orders: branch read"
  on delivery_orders for select to authenticated
  using (is_admin() or branch_id = get_user_branch_id());
create policy "delivery_orders: branch write"
  on delivery_orders for insert to authenticated
  with check (is_admin() or branch_id = get_user_branch_id());
create policy "delivery_orders: branch update"
  on delivery_orders for update to authenticated
  using (is_admin() or branch_id = get_user_branch_id())
  with check (is_admin() or branch_id = get_user_branch_id());

-- delivery_order_items
create policy "delivery_order_items: via order read"
  on delivery_order_items for select to authenticated
  using (
    exists (
      select 1 from delivery_orders d
      where d.id = delivery_order_id
        and (is_admin() or d.branch_id = get_user_branch_id())
    )
  );
create policy "delivery_order_items: branch write"
  on delivery_order_items for all to authenticated
  using (true) with check (true);

-- ════════════════════════════════════════════════════════════
-- SALES
-- ════════════════════════════════════════════════════════════

-- Tellers can only see their own sales; manager/admin see all branch sales
create policy "sales: read own or branch or admin"
  on sales for select to authenticated
  using (
    is_admin()
    or (get_user_role() = 'manager' and branch_id = get_user_branch_id())
    or (get_user_role() = 'teller'  and teller_id = auth.uid())
  );

create policy "sales: teller/manager/admin insert"
  on sales for insert to authenticated
  with check (
    teller_id = auth.uid()
    and (is_admin() or branch_id = get_user_branch_id())
  );

-- Only admin/manager can update (void, mark printed, efris update)
create policy "sales: admin/manager update"
  on sales for update to authenticated
  using (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()))
  with check (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()));

-- sale_items
create policy "sale_items: via sale read"
  on sale_items for select to authenticated
  using (
    exists (
      select 1 from sales s
      where s.id = sale_id
        and (
          is_admin()
          or (get_user_role() = 'manager' and s.branch_id = get_user_branch_id())
          or (get_user_role() = 'teller'  and s.teller_id = auth.uid())
        )
    )
  );
create policy "sale_items: insert during sale"
  on sale_items for insert to authenticated
  with check (true);

-- payments
create policy "payments: via sale read"
  on payments for select to authenticated
  using (
    exists (
      select 1 from sales s
      where s.id = sale_id
        and (
          is_admin()
          or (get_user_role() = 'manager' and s.branch_id = get_user_branch_id())
          or (get_user_role() = 'teller'  and s.teller_id = auth.uid())
        )
    )
  );
create policy "payments: insert during sale"
  on payments for insert to authenticated
  with check (true);

-- ════════════════════════════════════════════════════════════
-- RETURNS
-- ════════════════════════════════════════════════════════════

create policy "returns: branch read"
  on returns for select to authenticated
  using (is_admin() or branch_id = get_user_branch_id());

-- Only admin/manager can create returns
create policy "returns: admin/manager insert"
  on returns for insert to authenticated
  with check (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()));

create policy "returns: admin/manager update"
  on returns for update to authenticated
  using (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()))
  with check (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()));

-- return_items
create policy "return_items: via return read"
  on return_items for select to authenticated
  using (
    exists (
      select 1 from returns r
      where r.id = return_id
        and (is_admin() or r.branch_id = get_user_branch_id())
    )
  );
create policy "return_items: admin/manager write"
  on return_items for all to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- ════════════════════════════════════════════════════════════
-- RECONCILIATION
-- ════════════════════════════════════════════════════════════

create policy "reconciliation: branch read"
  on daily_reconciliations for select to authenticated
  using (is_admin() or branch_id = get_user_branch_id());

create policy "reconciliation: admin/manager write"
  on daily_reconciliations for all to authenticated
  using (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()))
  with check (is_admin_or_manager() and (is_admin() or branch_id = get_user_branch_id()));

create policy "denominations: via reconciliation read"
  on reconciliation_denominations for select to authenticated
  using (
    exists (
      select 1 from daily_reconciliations dr
      where dr.id = reconciliation_id
        and (is_admin() or dr.branch_id = get_user_branch_id())
    )
  );
create policy "denominations: admin/manager write"
  on reconciliation_denominations for all to authenticated
  using (is_admin_or_manager()) with check (is_admin_or_manager());

-- ════════════════════════════════════════════════════════════
-- EFRIS & AUDIT
-- ════════════════════════════════════════════════════════════

-- efris_submissions: admin/manager read; no client-side write (Edge Function only)
create policy "efris: admin/manager read"
  on efris_submissions for select to authenticated
  using (is_admin_or_manager());

-- audit_logs: admin read only; inserts via RPC (security definer)
create policy "audit: admin read"
  on audit_logs for select to authenticated
  using (is_admin());

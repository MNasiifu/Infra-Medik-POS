-- ============================================================
-- INFRA MEDIK POS — Migration 014: Triggers
-- Run after 013
-- ============================================================

-- ─── Generic updated_at trigger function ─────────────────────
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Apply updated_at to all mutable tables
create trigger trg_branches_updated_at
  before update on branches
  for each row execute function touch_updated_at();

create trigger trg_categories_updated_at
  before update on categories
  for each row execute function touch_updated_at();

create trigger trg_manufacturers_updated_at
  before update on manufacturers
  for each row execute function touch_updated_at();

create trigger trg_suppliers_updated_at
  before update on suppliers
  for each row execute function touch_updated_at();

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function touch_updated_at();

create trigger trg_products_updated_at
  before update on products
  for each row execute function touch_updated_at();

create trigger trg_product_units_updated_at
  before update on product_units
  for each row execute function touch_updated_at();

create trigger trg_stock_batches_updated_at
  before update on stock_batches
  for each row execute function touch_updated_at();

create trigger trg_stock_takes_updated_at
  before update on stock_takes
  for each row execute function touch_updated_at();

create trigger trg_purchase_orders_updated_at
  before update on purchase_orders
  for each row execute function touch_updated_at();

create trigger trg_purchase_order_items_updated_at
  before update on purchase_order_items
  for each row execute function touch_updated_at();

create trigger trg_customers_updated_at
  before update on customers
  for each row execute function touch_updated_at();

create trigger trg_delivery_orders_updated_at
  before update on delivery_orders
  for each row execute function touch_updated_at();

create trigger trg_sales_updated_at
  before update on sales
  for each row execute function touch_updated_at();

create trigger trg_returns_updated_at
  before update on returns
  for each row execute function touch_updated_at();

create trigger trg_reconciliations_updated_at
  before update on daily_reconciliations
  for each row execute function touch_updated_at();

create trigger trg_efris_updated_at
  before update on efris_submissions
  for each row execute function touch_updated_at();

-- ─── Auto-compute selling_price on product_units ─────────────
-- Ensures selling_price = price_before_vat + vat_amount always
create or replace function compute_selling_price()
returns trigger
language plpgsql
as $$
begin
  new.selling_price := round(new.price_before_vat + new.vat_amount, 2);
  return new;
end;
$$;

create trigger trg_product_units_selling_price
  before insert or update of price_before_vat, vat_amount
  on product_units
  for each row execute function compute_selling_price();

-- ─── Validate: prevent sale on voided sale ───────────────────
create or replace function prevent_void_on_completed()
returns trigger
language plpgsql
as $$
begin
  if old.is_voided = true and new.is_voided = false then
    raise exception 'Cannot un-void a sale';
  end if;
  return new;
end;
$$;

create trigger trg_sales_no_unvoid
  before update of is_voided on sales
  for each row execute function prevent_void_on_completed();

-- ─── Generate delivery order number ──────────────────────────
create or replace function generate_delivery_order_number()
returns trigger
language plpgsql
as $$
declare
  v_date text;
  v_seq  integer;
begin
  if new.order_number is null or new.order_number = '' then
    v_date := to_char(current_date, 'YYYYMMDD');
    select coalesce(max((regexp_match(order_number, '\d+$'))[1]::integer), 0) + 1
    into v_seq
    from delivery_orders
    where order_number like 'DEL-' || v_date || '-%';
    new.order_number := 'DEL-' || v_date || '-' || lpad(v_seq::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_delivery_order_number
  before insert on delivery_orders
  for each row execute function generate_delivery_order_number();

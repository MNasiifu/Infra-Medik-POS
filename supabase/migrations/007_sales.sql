-- ============================================================
-- INFRA MEDIK POS — Migration 007: Sales
-- Run after 006
-- ============================================================

-- ─── Sales ───────────────────────────────────────────────────
create table sales (
  id                       uuid primary key default uuid_generate_v4(),
  branch_id                uuid not null references branches(id) on delete restrict,
  sale_number              text not null unique,
  customer_id              uuid references customers(id) on delete set null,
  teller_id                uuid not null references profiles(id) on delete restrict,
  sale_type                sale_type not null default 'walk_in',
  delivery_order_id        uuid references delivery_orders(id) on delete set null,
  subtotal_before_vat      numeric(14,2) not null default 0,
  vat_amount               numeric(14,2) not null default 0,
  total_amount             numeric(14,2) not null default 0,
  payment_status           payment_status not null default 'pending',
  is_voided                boolean not null default false,
  voided_by                uuid references profiles(id) on delete set null,
  voided_at                timestamptz,
  void_reason              text,
  efris_status             efris_status not null default 'pending',
  efris_verification_code  text,
  efris_qr_data            text,
  receipt_printed          boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Now add the sale_id FK back to delivery_orders
alter table delivery_orders
  add constraint fk_delivery_sale
  foreign key (sale_id) references sales(id) on delete set null;

-- ─── Sale Items ──────────────────────────────────────────────
create table sale_items (
  id                    uuid primary key default uuid_generate_v4(),
  sale_id               uuid not null references sales(id) on delete cascade,
  product_id            uuid not null references products(id) on delete restrict,
  product_unit_id       uuid not null references product_units(id) on delete restrict,
  batch_id              uuid references stock_batches(id) on delete set null,
  quantity              numeric(12,4) not null,
  unit_price_before_vat numeric(12,2) not null,
  vat_per_unit          numeric(12,2) not null default 0,
  unit_price_inclusive  numeric(12,2) not null,
  line_total_before_vat numeric(14,2) not null,
  line_vat              numeric(14,2) not null default 0,
  line_total            numeric(14,2) not null,
  is_vat_exempt         boolean not null default false,
  created_at            timestamptz not null default now()
);

-- ─── Payments ────────────────────────────────────────────────
-- A sale can have multiple payment rows (split payment)
create table payments (
  id               uuid primary key default uuid_generate_v4(),
  sale_id          uuid not null references sales(id) on delete cascade,
  payment_method   payment_method not null,
  amount           numeric(14,2) not null,
  reference_number text,    -- MoMo transaction ref
  created_at       timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────
create index idx_sales_branch       on sales(branch_id);
create index idx_sales_teller       on sales(teller_id);
create index idx_sales_created_at   on sales(created_at desc);
-- date_trunc('day', timestamptz) is STABLE so it cannot be used directly in an
-- index expression. This wrapper is declared IMMUTABLE because the timezone is
-- hardcoded; change 'Africa/Kampala' to match your branch timezone if needed.
create or replace function sales_day(ts timestamptz)
  returns date language sql immutable parallel safe as
  $$ select (ts at time zone 'Africa/Kampala')::date $$;

create index idx_sales_date         on sales(sales_day(created_at));
create index idx_sales_number       on sales(sale_number);
create index idx_sales_voided       on sales(is_voided);
create index idx_sales_efris        on sales(efris_status) where efris_status = 'pending';
create index idx_sale_items_sale    on sale_items(sale_id);
create index idx_sale_items_product on sale_items(product_id);
create index idx_sale_items_batch   on sale_items(batch_id);
create index idx_payments_sale      on payments(sale_id);
create index idx_payments_method    on payments(payment_method);

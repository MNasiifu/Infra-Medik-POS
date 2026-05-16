-- ============================================================
-- INFRA MEDIK POS — Migration 005: Inventory
-- Run after 004
-- ============================================================

-- ─── Stock Batches (FEFO) ────────────────────────────────────
-- One row per received batch. FEFO selects by earliest expiry_date.
create table stock_batches (
  id                  uuid primary key default uuid_generate_v4(),
  product_id          uuid not null references products(id) on delete restrict,
  product_unit_id     uuid not null references product_units(id) on delete restrict,
  branch_id           uuid not null references branches(id) on delete restrict,
  supplier_id         uuid references suppliers(id) on delete set null,
  batch_number        text not null,
  expiry_date         date,                        -- null means no expiry (e.g. some consumables)
  quantity_received   numeric(12,4) not null,
  quantity_remaining  numeric(12,4) not null,
  cost_price_per_unit numeric(12,2) not null default 0,
  receiving_id        uuid,                        -- FK added after stock_receivings table
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chk_qty_remaining check (quantity_remaining >= 0)
);

-- ─── Stock Adjustments ───────────────────────────────────────
create table stock_adjustments (
  id              uuid primary key default uuid_generate_v4(),
  branch_id       uuid not null references branches(id) on delete restrict,
  product_id      uuid not null references products(id) on delete restrict,
  batch_id        uuid references stock_batches(id) on delete set null,
  adjustment_type adjustment_type not null,
  quantity        numeric(12,4) not null,           -- positive = add, negative = remove
  reason          text,
  adjusted_by     uuid not null references profiles(id) on delete restrict,
  created_at      timestamptz not null default now()
);

-- ─── Stock Takes ─────────────────────────────────────────────
create table stock_takes (
  id           uuid primary key default uuid_generate_v4(),
  branch_id    uuid not null references branches(id) on delete restrict,
  status       stock_take_status not null default 'draft',
  notes        text,
  started_by   uuid not null references profiles(id) on delete restrict,
  completed_by uuid references profiles(id) on delete set null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table stock_take_items (
  id               uuid primary key default uuid_generate_v4(),
  stock_take_id    uuid not null references stock_takes(id) on delete cascade,
  product_id       uuid not null references products(id) on delete restrict,
  batch_id         uuid references stock_batches(id) on delete set null,
  system_quantity  numeric(12,4) not null default 0,
  counted_quantity numeric(12,4),
  variance         numeric(12,4) generated always as (counted_quantity - system_quantity) stored,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ─── Purchase Orders ─────────────────────────────────────────
create table purchase_orders (
  id                     uuid primary key default uuid_generate_v4(),
  branch_id              uuid not null references branches(id) on delete restrict,
  supplier_id            uuid not null references suppliers(id) on delete restrict,
  po_number              text not null unique,
  status                 po_status not null default 'draft',
  order_date             date not null default current_date,
  expected_delivery_date date,
  notes                  text,
  subtotal               numeric(14,2) not null default 0,
  created_by             uuid not null references profiles(id) on delete restrict,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table purchase_order_items (
  id                  uuid primary key default uuid_generate_v4(),
  purchase_order_id   uuid not null references purchase_orders(id) on delete cascade,
  product_id          uuid not null references products(id) on delete restrict,
  product_unit_id     uuid not null references product_units(id) on delete restrict,
  quantity_ordered    numeric(12,4) not null,
  quantity_received   numeric(12,4) not null default 0,
  cost_price_per_unit numeric(12,2) not null default 0,
  line_total          numeric(14,2) generated always as (quantity_ordered * cost_price_per_unit) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── Stock Receivings ────────────────────────────────────────
create table stock_receivings (
  id                uuid primary key default uuid_generate_v4(),
  branch_id         uuid not null references branches(id) on delete restrict,
  supplier_id       uuid references suppliers(id) on delete set null,
  purchase_order_id uuid references purchase_orders(id) on delete set null,  -- null = manual receive
  received_by       uuid not null references profiles(id) on delete restrict,
  received_at       timestamptz not null default now(),
  notes             text,
  created_at        timestamptz not null default now()
);

create table stock_receiving_items (
  id                    uuid primary key default uuid_generate_v4(),
  receiving_id          uuid not null references stock_receivings(id) on delete cascade,
  product_id            uuid not null references products(id) on delete restrict,
  product_unit_id       uuid not null references product_units(id) on delete restrict,
  purchase_order_item_id uuid references purchase_order_items(id) on delete set null,
  batch_number          text not null,
  expiry_date           date,
  quantity_received     numeric(12,4) not null,
  cost_price_per_unit   numeric(12,2) not null default 0,
  created_at            timestamptz not null default now()
);

-- Now add the FK from stock_batches to stock_receivings
alter table stock_batches
  add constraint fk_batch_receiving
  foreign key (receiving_id) references stock_receivings(id) on delete set null;

-- ─── Indexes ─────────────────────────────────────────────────
create index idx_stock_batches_product       on stock_batches(product_id);
create index idx_stock_batches_branch        on stock_batches(branch_id);
create index idx_stock_batches_expiry        on stock_batches(expiry_date asc nulls last);
create index idx_stock_batches_remaining     on stock_batches(quantity_remaining) where quantity_remaining > 0;
create index idx_stock_adjustments_product   on stock_adjustments(product_id);
create index idx_stock_adjustments_branch    on stock_adjustments(branch_id);
create index idx_stock_take_items_take       on stock_take_items(stock_take_id);
create index idx_po_branch                   on purchase_orders(branch_id);
create index idx_po_supplier                 on purchase_orders(supplier_id);
create index idx_po_items_po                 on purchase_order_items(purchase_order_id);
create index idx_receiving_branch            on stock_receivings(branch_id);
create index idx_receiving_po                on stock_receivings(purchase_order_id);
create index idx_receiving_items_receiving   on stock_receiving_items(receiving_id);

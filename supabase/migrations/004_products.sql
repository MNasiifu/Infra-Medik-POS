-- ============================================================
-- INFRA MEDIK POS — Migration 004: Products
-- Run after 003
-- ============================================================

-- ─── Products ────────────────────────────────────────────────
create table products (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  generic_name    text,
  category_id     uuid references categories(id) on delete set null,
  manufacturer_id uuid references manufacturers(id) on delete set null,
  country_id      uuid references countries(id) on delete set null,   -- country of origin
  supplier_id     uuid references suppliers(id) on delete set null,   -- primary supplier
  dosage_form     dosage_form,
  strength        text,           -- e.g. "500mg", "250mg/5ml" — free text, optional
  description     text,
  is_vat_exempt   boolean not null default false,
  is_active       boolean not null default true,
  image_url       text,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz    -- soft delete
);

-- ─── Product Units ───────────────────────────────────────────
-- Each product can have multiple selling units (e.g. piece, strip, bottle)
create table product_units (
  id                   uuid primary key default uuid_generate_v4(),
  product_id           uuid not null references products(id) on delete cascade,
  unit_name            text not null,                        -- e.g. "Piece", "Strip", "Bottle"
  conversion_factor    numeric(10,4) not null default 1,    -- relative to base unit (piece)
  price_before_vat     numeric(12,2) not null default 0,    -- selling price before VAT
  vat_amount           numeric(12,2) not null default 0,    -- VAT portion
  selling_price        numeric(12,2) not null default 0,    -- final inclusive price (auto-computed)
  cost_price           numeric(12,2) not null default 0,    -- average cost (for P&L)
  is_default           boolean not null default false,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint uq_product_unit unique (product_id, unit_name)
);

-- Ensure only one default unit per product
create unique index uq_product_default_unit
  on product_units(product_id) where is_default = true;

-- ─── Product Barcodes ────────────────────────────────────────
-- A product can have multiple barcodes (manufacturer + generated)
create table product_barcodes (
  id             uuid primary key default uuid_generate_v4(),
  product_id     uuid not null references products(id) on delete cascade,
  barcode        text not null unique,
  is_generated   boolean not null default false,   -- true = we generated it; false = manufacturer's
  created_at     timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────
create index idx_products_name         on products using gin(name gin_trgm_ops);
create index idx_products_generic_name on products using gin(generic_name gin_trgm_ops);
create index idx_products_category     on products(category_id);
create index idx_products_manufacturer on products(manufacturer_id);
create index idx_products_active       on products(is_active) where deleted_at is null;
create index idx_product_units_product on product_units(product_id);
create index idx_barcodes_barcode      on product_barcodes(barcode);
create index idx_barcodes_product      on product_barcodes(product_id);

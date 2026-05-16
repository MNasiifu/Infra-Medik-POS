-- ============================================================
-- INFRA MEDIK POS — Migration 009: VAT Configuration
-- Run after 008
-- ============================================================

-- ─── VAT Rates ───────────────────────────────────────────────
-- Maintains a history of VAT rates (Uganda standard = 18%)
create table vat_rates (
  id             uuid primary key default uuid_generate_v4(),
  rate           numeric(5,2) not null,    -- e.g. 18.00
  is_default     boolean not null default false,
  effective_from date not null default current_date,
  effective_to   date,                     -- null = currently active
  description    text,
  created_at     timestamptz not null default now()
);

-- Only one active default at a time
create unique index uq_vat_rate_default
  on vat_rates(is_default) where is_default = true and effective_to is null;

-- ─── VAT Exempt Products ─────────────────────────────────────
-- Products where is_vat_exempt = true on products table are globally exempt.
-- This junction table allows finer time-bound exemption overrides.
create table vat_exempt_overrides (
  id             uuid primary key default uuid_generate_v4(),
  product_id     uuid not null references products(id) on delete cascade,
  effective_from date not null default current_date,
  effective_to   date,
  reason         text,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint uq_vat_exempt unique (product_id, effective_from)
);

create index idx_vat_exempt_product on vat_exempt_overrides(product_id);

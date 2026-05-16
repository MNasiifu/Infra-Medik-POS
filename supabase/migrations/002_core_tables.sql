-- ============================================================
-- INFRA MEDIK POS — Migration 002: Core Reference Tables
-- Run after 001
-- ============================================================

-- ─── Branches ────────────────────────────────────────────────
create table branches (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  address     text,
  phone       text,
  email       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Countries ───────────────────────────────────────────────
create table countries (
  id    uuid primary key default uuid_generate_v4(),
  name  text not null unique,
  code  char(2) unique  -- ISO 3166-1 alpha-2
);

-- ─── Categories ──────────────────────────────────────────────
create table categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Manufacturers ───────────────────────────────────────────
create table manufacturers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  country_id  uuid references countries(id) on delete set null,
  website     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Suppliers ───────────────────────────────────────────────
create table suppliers (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  tin             text,
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────
create index idx_manufacturers_country on manufacturers(country_id);
create index idx_suppliers_name on suppliers(name);

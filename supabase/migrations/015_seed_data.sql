-- ============================================================
-- INFRA MEDIK POS — Migration 015: Seed Data
-- Run after 014
-- Inserts: default branch, VAT rate, UGX denominations,
--          product categories, common countries
-- ============================================================

-- ─── Default Branch (INFRA MEDIK — Freedom City Mall) ──────────
insert into branches (id, name, address, phone, email, is_active)
values (
  '00000000-0000-0000-0000-000000000001',
  'INFRA MEDIK — Freedom City Mall',
  'Freedom City Mall, Namasuba, Entebbe Road, Kampala, Uganda',
  '0773456908',
  'info@inframedikafrika.com',
  true
)
on conflict (id) do nothing;

-- ─── Default VAT Rate (Uganda 18%) ───────────────────────────
insert into vat_rates (rate, is_default, effective_from, description)
values (18.00, true, '2024-01-01', 'Uganda Standard VAT Rate — URA')
on conflict do nothing;

-- ─── UGX Cash Denominations ──────────────────────────────────
-- Used in daily reconciliation denomination counting
-- Stored as reference; actual counts are in reconciliation_denominations
-- (No table for this — denominations are hardcoded in the UI and seeded here
--  as a comment for reference)
-- Notes: 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100

-- ─── Product Categories ──────────────────────────────────────
insert into categories (name, description) values
  ('Prescription Drugs',     'Drugs requiring a valid prescription'),
  ('OTC Drugs',              'Over-the-counter medications'),
  ('Supplements',            'Vitamins, minerals and nutritional supplements'),
  ('Cosmetics',              'Skin care, hair care and beauty products'),
  ('Women Wellness',         'Women health and reproductive wellness products'),
  ('Medical Consumables',    'Gloves, syringes, bandages and disposables'),
  ('Baby & Infant Care',     'Products for infants and young children'),
  ('Herbal & Traditional',   'Herbal and traditional medicine products'),
  ('Equipment',              'Medical devices and equipment'),
  ('Personal Hygiene',       'Soaps, sanitizers and hygiene products')
on conflict (name) do nothing;

-- ─── Common Countries (focus: Africa + major pharma origins) ──
insert into countries (name, code) values
  ('Uganda',              'UG'),
  ('Kenya',               'KE'),
  ('Tanzania',            'TZ'),
  ('Rwanda',              'RW'),
  ('India',               'IN'),
  ('China',               'CN'),
  ('Germany',             'DE'),
  ('United Kingdom',      'GB'),
  ('United States',       'US'),
  ('France',              'FR'),
  ('South Africa',        'ZA'),
  ('Pakistan',            'PK'),
  ('Bangladesh',          'BD'),
  ('Egypt',               'EG'),
  ('Nigeria',             'NG'),
  ('Netherlands',         'NL'),
  ('Switzerland',         'CH'),
  ('Belgium',             'BE'),
  ('Denmark',             'DK'),
  ('Sweden',              'SE'),
  ('Japan',               'JP'),
  ('South Korea',         'KR'),
  ('Canada',              'CA'),
  ('Australia',           'AU'),
  ('Ethiopia',            'ET'),
  ('Ghana',               'GH'),
  ('Senegal',             'SN'),
  ('Morocco',             'MA')
on conflict (code) do nothing;

-- ─── Walk-in Anonymous Customer ──────────────────────────────
-- Used as default customer for POS sales with no named customer
insert into customers (id, full_name, customer_type, is_active)
values (
  '00000000-0000-0000-0000-000000000002',
  'Walk-In Customer',
  'walk_in',
  true
)
on conflict (id) do nothing;

-- ─── Verify setup ────────────────────────────────────────────
-- Run this to confirm seed data applied correctly:
-- select name from branches;
-- select rate, is_default from vat_rates;
-- select count(*) from categories;
-- select count(*) from countries;

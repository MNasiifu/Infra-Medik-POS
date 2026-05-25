-- ============================================================
-- INFRA MEDIK POS — Migration 001: Extensions & Enum Types
-- Run this first in Supabase SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";   -- fuzzy product search

-- ─── Enum: User Roles ────────────────────────────────────────
create type user_role as enum ('admin', 'manager', 'teller');

-- ─── Enum: Dosage Forms ──────────────────────────────────────
create type dosage_form as enum (
  'tablet', 'capsule', 'syrup', 'suspension', 'cream', 'dental foam',
  'ointment', 'gel', 'injection', 'drops', 'body butter', 'herbal tea', 'soap bar', 'shampoo', 'powder','lip balm', 'topical liquid', 'topical balm', 'topical oil', 'topical cream', 'make-up brush', 'make-up sponge',
  'inhaler', 'patch', 'suppository', 'pre-lubricated latex condom', 'liquid topical facial toner', 'liquid exfoliating mask', 'other'
);

-- ─── Enum: Stock Adjustment Types ────────────────────────────
create type adjustment_type as enum (
  'damage', 'expiry', 'theft', 'correction', 'return_to_supplier', 'other'
);

-- ─── Enum: Stock Take Status ─────────────────────────────────
create type stock_take_status as enum ('draft', 'in_progress', 'completed', 'cancelled');

-- ─── Enum: Purchase Order Status ─────────────────────────────
create type po_status as enum (
  'draft', 'sent', 'partially_received', 'received', 'cancelled'
);

-- ─── Enum: Customer Type ─────────────────────────────────────
create type customer_type as enum ('walk_in', 'account', 'delivery');

-- ─── Enum: Order Source ──────────────────────────────────────
create type order_source as enum ('phone', 'whatsapp', 'walk_in', 'other');

-- ─── Enum: Delivery Status ───────────────────────────────────
create type delivery_status as enum (
  'pending', 'confirmed', 'preparing', 'dispatched', 'delivered', 'cancelled'
);

-- ─── Enum: Sale Type ─────────────────────────────────────────
create type sale_type as enum ('walk_in', 'delivery', 'account');

-- ─── Enum: Payment Status ────────────────────────────────────
create type payment_status as enum ('paid', 'partial', 'pending');

-- ─── Enum: Payment Method ────────────────────────────────────
create type payment_method as enum ('cash', 'mtn_momo', 'airtel_money');

-- ─── Enum: Return Type ───────────────────────────────────────
create type return_type as enum ('restock', 'writeoff');

-- ─── Enum: Return Status ─────────────────────────────────────
create type return_status as enum ('pending', 'approved', 'completed', 'rejected');

-- ─── Enum: EFRIS Submission Status ───────────────────────────
create type efris_status as enum ('pending', 'submitted', 'failed', 'not_applicable');

-- ─── Enum: Reconciliation Status ─────────────────────────────
create type reconciliation_status as enum ('open', 'submitted', 'approved');

-- ─── Enum: Audit Action ──────────────────────────────────────
create type audit_action as enum (
  'create', 'update', 'delete', 'void_sale', 'process_return',
  'complete_sale', 'adjust_stock', 'create_user', 'change_role',
  'close_reconciliation', 'complete_stock_take'
);

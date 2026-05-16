-- ============================================================
-- INFRA MEDIK POS — Migration 011: EFRIS Submissions & Audit Log
-- Run after 010
-- ============================================================

-- ─── EFRIS Submissions ───────────────────────────────────────
-- Tracks every submission attempt to URA EFRIS API
create table efris_submissions (
  id                uuid primary key default uuid_generate_v4(),
  sale_id           uuid not null references sales(id) on delete restrict,
  submission_type   text not null default 'sale',      -- 'sale' | 'credit_note' (return)
  request_payload   jsonb,                              -- what we sent to URA
  response_payload  jsonb,                              -- what URA returned
  status            efris_status not null default 'pending',
  verification_code text,                               -- from URA on success
  qr_data           text,                               -- QR string for receipt
  retry_count       smallint not null default 0,
  error_message     text,
  submitted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── Audit Log ───────────────────────────────────────────────
-- Immutable append-only log — never update or delete rows here
create table audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id) on delete set null,
  action      audit_action not null,
  table_name  text not null,
  record_id   uuid,
  old_values  jsonb,
  new_values  jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────
create index idx_efris_sale    on efris_submissions(sale_id);
create index idx_efris_status  on efris_submissions(status) where status in ('pending', 'failed');
create index idx_audit_user    on audit_logs(user_id);
create index idx_audit_action  on audit_logs(action);
create index idx_audit_table   on audit_logs(table_name, record_id);
create index idx_audit_created on audit_logs(created_at desc);

-- Prevent deletes and updates on audit_log (immutable)
create or replace rule no_delete_audit as on delete to audit_logs do instead nothing;
create or replace rule no_update_audit as on update to audit_logs do instead nothing;

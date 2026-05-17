-- ============================================================
-- INFRA MEDIK POS — Migration 017: Add stock_in_date
-- Tracks when stock physically arrived, separate from received_at
-- ============================================================

-- Add stock_in_date to stock_receiving_items table
alter table stock_receiving_items
add column stock_in_date date not null default current_date;

-- Add constraint: stock_in_date must be <= expiry_date (if expiry exists)
alter table stock_receiving_items
add constraint chk_stock_in_date_before_expiry
  check (stock_in_date <= expiry_date or expiry_date is null);

-- Add stock_in_date to stock_batches table
alter table stock_batches
add column stock_in_date date not null default current_date;

-- Add constraint: stock_in_date must be <= expiry_date (if expiry exists)
alter table stock_batches
add constraint chk_batch_stock_in_date_before_expiry
  check (stock_in_date <= expiry_date or expiry_date is null);

-- Create indexes for stock_in_date to optimize FIFO/rotation queries
create index idx_stock_receiving_items_stock_in_date on stock_receiving_items(stock_in_date asc);
create index idx_stock_batches_stock_in_date on stock_batches(stock_in_date asc);

-- ════════════════════════════════════════════════════════════

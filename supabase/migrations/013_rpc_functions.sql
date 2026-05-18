-- ============================================================
-- INFRA MEDIK POS — Migration 013: RPC Functions
-- Run after 012
-- All functions use SECURITY DEFINER to bypass RLS where needed
-- for atomic operations, then enforce their own permission checks.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. UTILITY: Generate sequential sale number
-- ════════════════════════════════════════════════════════════
create or replace function generate_sale_number()
returns text
language plpgsql
security definer
as $$
declare
  v_date text;
  v_seq  integer;
begin
  v_date := to_char(current_date, 'YYYYMMDD');
  select coalesce(max((regexp_match(sale_number, '\d+$'))[1]::integer), 0) + 1
  into v_seq
  from sales
  where sale_number like 'INV-' || v_date || '-%';
  return 'INV-' || v_date || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 2. UTILITY: Generate sequential PO number
-- ════════════════════════════════════════════════════════════
create or replace function generate_po_number()
returns text
language plpgsql
security definer
as $$
declare
  v_date text;
  v_seq  integer;
begin
  v_date := to_char(current_date, 'YYYYMM');
  select coalesce(max((regexp_match(po_number, '\d+$'))[1]::integer), 0) + 1
  into v_seq
  from purchase_orders
  where po_number like 'PO-' || v_date || '-%';
  return 'PO-' || v_date || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 3. UTILITY: Generate return number
-- ════════════════════════════════════════════════════════════
create or replace function generate_return_number()
returns text
language plpgsql
security definer
as $$
declare
  v_date text;
  v_seq  integer;
begin
  v_date := to_char(current_date, 'YYYYMMDD');
  select coalesce(max((regexp_match(return_number, '\d+$'))[1]::integer), 0) + 1
  into v_seq
  from returns
  where return_number like 'RET-' || v_date || '-%';
  return 'RET-' || v_date || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 4. UTILITY: Get current VAT rate
-- ════════════════════════════════════════════════════════════
create or replace function get_current_vat_rate()
returns numeric
language sql
security definer stable
as $$
  select rate from vat_rates
  where is_default = true and effective_to is null
  limit 1;
$$;

-- ════════════════════════════════════════════════════════════
-- 5. CORE: Complete a Sale (atomic FEFO stock deduction)
-- ════════════════════════════════════════════════════════════
-- Input JSON shape:
-- {
--   "branch_id": "uuid",
--   "customer_id": "uuid|null",
--   "sale_type": "walk_in|delivery|account",
--   "delivery_order_id": "uuid|null",
--   "items": [
--     {
--       "product_id": "uuid",
--       "product_unit_id": "uuid",
--       "quantity": 2,
--       "unit_price_before_vat": 1500.00,
--       "vat_per_unit": 270.00,
--       "unit_price_inclusive": 1770.00,
--       "is_vat_exempt": false
--     }
--   ],
--   "payments": [
--     { "payment_method": "cash", "amount": 3540.00, "reference_number": null }
--   ]
-- }
create or replace function complete_sale(p_data jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sale_id           uuid;
  v_sale_number       text;
  v_item              jsonb;
  v_batch             record;
  v_qty_needed        numeric;
  v_qty_from_batch    numeric;
  v_total_before_vat  numeric := 0;
  v_total_vat         numeric := 0;
  v_total             numeric := 0;
  v_item_before_vat   numeric;
  v_item_vat          numeric;
  v_item_inclusive    numeric;
  v_item_qty          numeric;
  v_batch_qty_deducted numeric;
begin
  -- Permission check
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  v_sale_number := generate_sale_number();

  -- Create the sale header (totals updated at end)
  insert into sales (
    branch_id, sale_number, customer_id, teller_id,
    sale_type, delivery_order_id,
    subtotal_before_vat, vat_amount, total_amount, payment_status
  ) values (
    (p_data->>'branch_id')::uuid,
    v_sale_number,
    nullif(p_data->>'customer_id', '')::uuid,
    auth.uid(),
    (p_data->>'sale_type')::sale_type,
    nullif(p_data->>'delivery_order_id', '')::uuid,
    0, 0, 0, 'pending'
  ) returning id into v_sale_id;

  -- Process each cart item using FEFO
  for v_item in select * from jsonb_array_elements(p_data->'items') loop

    v_item_qty          := (v_item->>'quantity')::numeric;
    v_item_before_vat   := (v_item->>'unit_price_before_vat')::numeric;
    v_item_vat          := (v_item->>'vat_per_unit')::numeric;
    v_item_inclusive    := (v_item->>'unit_price_inclusive')::numeric;
    v_qty_needed        := v_item_qty;

    -- FEFO batch loop: earliest expiry first, then oldest batch
    for v_batch in
      select id, quantity_remaining
      from stock_batches
      where product_id       = (v_item->>'product_id')::uuid
        and product_unit_id  = (v_item->>'product_unit_id')::uuid
        and branch_id        = (p_data->>'branch_id')::uuid
        and quantity_remaining > 0
        and (expiry_date is null or expiry_date >= current_date)
      order by expiry_date asc nulls last, created_at asc
      for update  -- row-level lock to prevent race conditions
    loop
      exit when v_qty_needed <= 0;

      v_qty_from_batch := least(v_batch.quantity_remaining, v_qty_needed);
      v_batch_qty_deducted := v_qty_from_batch;

      -- Deduct from batch
      update stock_batches
      set quantity_remaining = quantity_remaining - v_qty_from_batch,
          updated_at         = now()
      where id = v_batch.id;

      -- Insert a sale_item row per batch segment consumed
      insert into sale_items (
        sale_id, product_id, product_unit_id, batch_id, quantity,
        unit_price_before_vat, vat_per_unit, unit_price_inclusive,
        line_total_before_vat, line_vat, line_total, is_vat_exempt
      ) values (
        v_sale_id,
        (v_item->>'product_id')::uuid,
        (v_item->>'product_unit_id')::uuid,
        v_batch.id,
        v_qty_from_batch,
        v_item_before_vat,
        v_item_vat,
        v_item_inclusive,
        round(v_item_before_vat * v_qty_from_batch, 2),
        round(v_item_vat        * v_qty_from_batch, 2),
        round(v_item_inclusive  * v_qty_from_batch, 2),
        (v_item->>'is_vat_exempt')::boolean
      );

      v_qty_needed := v_qty_needed - v_qty_from_batch;
    end loop;

    if v_qty_needed > 0 then
      raise exception 'Insufficient stock for product %', v_item->>'product_id'
        using errcode = 'P0001';
    end if;

    v_total_before_vat := v_total_before_vat + round(v_item_before_vat * v_item_qty, 2);
    v_total_vat        := v_total_vat        + round(v_item_vat        * v_item_qty, 2);
    v_total            := v_total            + round(v_item_inclusive   * v_item_qty, 2);
  end loop;

  -- Insert split payments
  insert into payments (sale_id, payment_method, amount, reference_number)
  select
    v_sale_id,
    (p->>'method')::payment_method,
    (p->>'amount')::numeric,
    nullif(p->>'reference_number', '')
  from jsonb_array_elements(p_data->'payments') p;

  -- Update sale totals & mark as paid
  update sales
  set subtotal_before_vat = v_total_before_vat,
      vat_amount          = v_total_vat,
      total_amount        = v_total,
      payment_status      = 'paid',
      updated_at          = now()
  where id = v_sale_id;

  -- If linked to delivery order, mark it delivered
  if (p_data->>'delivery_order_id') is not null then
    update delivery_orders
    set status     = 'delivered',
        sale_id    = v_sale_id,
        updated_at = now()
    where id = (p_data->>'delivery_order_id')::uuid;
  end if;

  -- Audit log
  insert into audit_logs (user_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'complete_sale', 'sales', v_sale_id,
          jsonb_build_object('sale_number', v_sale_number, 'total', v_total));

  return jsonb_build_object(
    'success',      true,
    'sale_id',      v_sale_id,
    'sale_number',  v_sale_number,
    'total_amount', v_total,
    'vat_amount',   v_total_vat
  );
exception
  when others then
    raise exception '%', sqlerrm;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 6. CORE: Void a Sale
-- ════════════════════════════════════════════════════════════
create or replace function void_sale(p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sale record;
  v_item record;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied: only admin or manager can void sales';
  end if;

  select * into v_sale from sales where id = p_sale_id;

  if not found then
    raise exception 'Sale not found';
  end if;
  if v_sale.is_voided then
    raise exception 'Sale is already voided';
  end if;

  -- Restore stock to each batch consumed
  for v_item in
    select si.batch_id, si.quantity, si.product_id
    from sale_items si
    where si.sale_id = p_sale_id
      and si.batch_id is not null
  loop
    update stock_batches
    set quantity_remaining = quantity_remaining + v_item.quantity,
        updated_at         = now()
    where id = v_item.batch_id;
  end loop;

  -- Mark sale voided
  update sales
  set is_voided   = true,
      voided_by   = auth.uid(),
      voided_at   = now(),
      void_reason = p_reason,
      updated_at  = now()
  where id = p_sale_id;

  -- Audit
  insert into audit_logs (user_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'void_sale', 'sales', p_sale_id,
          jsonb_build_object('reason', p_reason));

  return jsonb_build_object('success', true, 'sale_id', p_sale_id);
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 7. CORE: Process a Return
-- ════════════════════════════════════════════════════════════
-- Input JSON:
-- {
--   "sale_id": "uuid",
--   "branch_id": "uuid",
--   "customer_id": "uuid|null",
--   "reason": "text",
--   "return_type": "restock|writeoff",
--   "refund_method": "cash|mtn_momo|airtel_money",
--   "notes": "text|null",
--   "items": [
--     {
--       "sale_item_id": "uuid",
--       "product_id": "uuid",
--       "product_unit_id": "uuid",
--       "batch_id": "uuid|null",
--       "quantity_returned": 1,
--       "refund_amount": 1770.00
--     }
--   ]
-- }
create or replace function process_return(p_data jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_return_id     uuid;
  v_return_number text;
  v_item          jsonb;
  v_total_refund  numeric := 0;
  v_qty_returned  numeric;
  v_refund_amt    numeric;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied: only admin or manager can process returns';
  end if;

  v_return_number := generate_return_number();

  -- Calculate total refund
  select coalesce(sum((i->>'refund_amount')::numeric), 0)
  into v_total_refund
  from jsonb_array_elements(p_data->'items') i;

  -- Create return header
  insert into returns (
    branch_id, return_number, sale_id, customer_id,
    processed_by, reason, return_type, refund_method,
    status, total_refund, notes
  ) values (
    (p_data->>'branch_id')::uuid,
    v_return_number,
    (p_data->>'sale_id')::uuid,
    nullif(p_data->>'customer_id', '')::uuid,
    auth.uid(),
    p_data->>'reason',
    (p_data->>'return_type')::return_type,
    (p_data->>'refund_method')::payment_method,
    'approved',   -- manager/admin creates as already approved
    v_total_refund,
    nullif(p_data->>'notes', '')
  ) returning id into v_return_id;

  -- Process each return item
  for v_item in select * from jsonb_array_elements(p_data->'items') loop
    v_qty_returned := (v_item->>'quantity_returned')::numeric;
    v_refund_amt   := (v_item->>'refund_amount')::numeric;

    insert into return_items (
      return_id, sale_item_id, product_id, product_unit_id,
      batch_id, quantity_returned, refund_amount, restocked
    ) values (
      v_return_id,
      (v_item->>'sale_item_id')::uuid,
      (v_item->>'product_id')::uuid,
      (v_item->>'product_unit_id')::uuid,
      nullif(v_item->>'batch_id', '')::uuid,
      v_qty_returned,
      v_refund_amt,
      (p_data->>'return_type') = 'restock'
    );

    -- If restock, add quantity back to the original batch
    if (p_data->>'return_type') = 'restock'
       and (v_item->>'batch_id') is not null
    then
      update stock_batches
      set quantity_remaining = quantity_remaining + v_qty_returned,
          updated_at         = now()
      where id = (v_item->>'batch_id')::uuid;
    end if;
  end loop;

  -- Update status to completed
  update returns
  set status = 'completed', approved_by = auth.uid(), approved_at = now()
  where id = v_return_id;

  -- Audit
  insert into audit_logs (user_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'process_return', 'returns', v_return_id,
          jsonb_build_object('return_number', v_return_number, 'total_refund', v_total_refund));

  return jsonb_build_object(
    'success',       true,
    'return_id',     v_return_id,
    'return_number', v_return_number,
    'total_refund',  v_total_refund
  );
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 8. CORE: Receive Stock (creates batches via FEFO)
-- ════════════════════════════════════════════════════════════
-- Input JSON:
-- {
--   "branch_id": "uuid",
--   "supplier_id": "uuid|null",
--   "purchase_order_id": "uuid|null",
--   "notes": "text|null",
--   "items": [
--     {
--       "product_id": "uuid",
--       "product_unit_id": "uuid",
--       "purchase_order_item_id": "uuid|null",
--       "batch_number": "BATCH001",
--       "expiry_date": "2026-12-31",
--       "quantity_received": 100,
--       "cost_price_per_unit": 800.00
--     }
--   ]
-- }
create or replace function complete_stock_receiving(p_data jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_receiving_id uuid;
  v_item         jsonb;
  v_batch_id     uuid;
  v_expiry_date  date;
  v_stock_in_date date;
  v_po_order_date date;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied';
  end if;

  -- Create receiving header
  insert into stock_receivings (
    branch_id, supplier_id, purchase_order_id, received_by, notes
  ) values (
    (p_data->>'branch_id')::uuid,
    nullif(p_data->>'supplier_id', '')::uuid,
    nullif(p_data->>'purchase_order_id', '')::uuid,
    auth.uid(),
    nullif(p_data->>'notes', '')
  ) returning id into v_receiving_id;

  -- Process each line item
  for v_item in select * from jsonb_array_elements(p_data->'items') loop
    v_expiry_date := nullif(v_item->>'expiry_date', '')::date;
    v_stock_in_date := nullif(v_item->>'stock_in_date', '')::date;

    -- Validation: stock_in_date is required
    if v_stock_in_date is null then
      raise exception 'stock_in_date is required for all receiving items';
    end if;

    -- Validation: stock_in_date must be <= expiry_date (if expiry exists)
    if v_expiry_date is not null and v_stock_in_date > v_expiry_date then
      raise exception 'Stock in date cannot be after expiry date';
    end if;

    -- Validation: if linked to PO, stock_in_date must be >= PO order_date
    if (v_item->>'purchase_order_item_id') is not null then
      select po.order_date into v_po_order_date
      from purchase_order_items poi
      join purchase_orders po on poi.purchase_order_id = po.id
      where poi.id = (v_item->>'purchase_order_item_id')::uuid;

      if v_po_order_date is not null and v_stock_in_date < v_po_order_date then
        raise exception 'Stock in date cannot be before purchase order date';
      end if;
    end if;

    -- Insert receiving item record
    insert into stock_receiving_items (
      receiving_id, product_id, product_unit_id,
      purchase_order_item_id, batch_number, expiry_date, stock_in_date,
      quantity_received, cost_price_per_unit
    ) values (
      v_receiving_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'product_unit_id')::uuid,
      nullif(v_item->>'purchase_order_item_id', '')::uuid,
      v_item->>'batch_number',
      v_expiry_date,
      v_stock_in_date,
      (v_item->>'quantity_received')::numeric,
      (v_item->>'cost_price_per_unit')::numeric
    );

    -- Create stock batch (FEFO-tracked)
    insert into stock_batches (
      product_id, product_unit_id, branch_id, supplier_id,
      batch_number, expiry_date, stock_in_date,
      quantity_received, quantity_remaining,
      cost_price_per_unit, receiving_id
    ) values (
      (v_item->>'product_id')::uuid,
      (v_item->>'product_unit_id')::uuid,
      (p_data->>'branch_id')::uuid,
      nullif(p_data->>'supplier_id', '')::uuid,
      v_item->>'batch_number',
      v_expiry_date,
      v_stock_in_date,
      (v_item->>'quantity_received')::numeric,
      (v_item->>'quantity_received')::numeric,
      (v_item->>'cost_price_per_unit')::numeric,
      v_receiving_id
    ) returning id into v_batch_id;

    -- If linked to a PO item, update its received quantity
    if (v_item->>'purchase_order_item_id') is not null then
      update purchase_order_items
      set quantity_received = quantity_received + (v_item->>'quantity_received')::numeric,
          updated_at        = now()
      where id = (v_item->>'purchase_order_item_id')::uuid;
    end if;
  end loop;

  -- Update PO status if all items fully received
  if (p_data->>'purchase_order_id') is not null then
    update purchase_orders po
    set status = (
      case
        when not exists (
          select 1 from purchase_order_items poi
          where poi.purchase_order_id = po.id
            and poi.quantity_received < poi.quantity_ordered
        ) then 'received'
        else 'partially_received'
      end
    )::po_status,
    updated_at = now()
    where id = (p_data->>'purchase_order_id')::uuid;
  end if;

  -- Audit
  insert into audit_logs (user_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'create', 'stock_receivings', v_receiving_id, p_data);

  return jsonb_build_object('success', true, 'receiving_id', v_receiving_id);
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 9. INVENTORY: Apply Stock Adjustment
-- ════════════════════════════════════════════════════════════
create or replace function apply_stock_adjustment(p_data jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_adj_id  uuid;
  v_qty     numeric;
  v_new_qty numeric;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied';
  end if;

  v_qty := (p_data->>'quantity')::numeric;

  -- Update batch quantity
  update stock_batches
  set quantity_remaining = greatest(0, quantity_remaining + v_qty),
      updated_at         = now()
  where id = (p_data->>'batch_id')::uuid
  returning quantity_remaining into v_new_qty;

  if not found then
    raise exception 'Batch not found';
  end if;

  -- Record adjustment
  insert into stock_adjustments (
    branch_id, product_id, batch_id,
    adjustment_type, quantity, reason, adjusted_by
  ) values (
    (p_data->>'branch_id')::uuid,
    (p_data->>'product_id')::uuid,
    (p_data->>'batch_id')::uuid,
    (p_data->>'adjustment_type')::adjustment_type,
    v_qty,
    p_data->>'reason',
    auth.uid()
  ) returning id into v_adj_id;

  -- Audit
  insert into audit_logs (user_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'adjust_stock', 'stock_adjustments', v_adj_id, p_data);

  return jsonb_build_object('success', true, 'adjustment_id', v_adj_id, 'new_quantity', v_new_qty);
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 10. INVENTORY: Complete Stock Take
-- ════════════════════════════════════════════════════════════
create or replace function complete_stock_take(p_stock_take_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_item record;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied';
  end if;

  -- For each item with a variance, auto-create an adjustment
  for v_item in
    select sti.*, st.branch_id
    from stock_take_items sti
    join stock_takes st on st.id = sti.stock_take_id
    where sti.stock_take_id = p_stock_take_id
      and sti.counted_quantity is not null
      and sti.variance != 0
      and sti.batch_id is not null
  loop
    update stock_batches
    set quantity_remaining = v_item.counted_quantity,
        updated_at         = now()
    where id = v_item.batch_id;

    insert into stock_adjustments (
      branch_id, product_id, batch_id, adjustment_type, quantity, reason, adjusted_by
    ) values (
      v_item.branch_id,
      v_item.product_id,
      v_item.batch_id,
      'correction',
      v_item.variance,
      'Stock take correction — take ID: ' || p_stock_take_id,
      auth.uid()
    );
  end loop;

  -- Mark stock take completed
  update stock_takes
  set status       = 'completed',
      completed_by = auth.uid(),
      completed_at = now(),
      updated_at   = now()
  where id = p_stock_take_id;

  -- Audit
  insert into audit_logs (user_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'complete_stock_take', 'stock_takes', p_stock_take_id, '{}'::jsonb);

  return jsonb_build_object('success', true, 'stock_take_id', p_stock_take_id);
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 11. REPORTS: Teller Sales Summary
-- ════════════════════════════════════════════════════════════
create or replace function get_teller_summary(
  p_teller_id  uuid    default null,   -- null = current user (for teller role)
  p_date_from  date    default current_date,
  p_date_to    date    default current_date,
  p_branch_id  uuid    default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_role       user_role;
  v_branch_id  uuid;
  v_teller_id  uuid;
  v_result     jsonb;
begin
  v_role      := get_user_role();
  v_branch_id := get_user_branch_id();

  -- Tellers can only see their own summary
  if v_role = 'teller' then
    v_teller_id := auth.uid();
  else
    v_teller_id := p_teller_id;  -- admin/manager can filter by any teller
  end if;

  select jsonb_build_object(
    'teller_id',          v_teller_id,
    'date_from',          p_date_from,
    'date_to',            p_date_to,
    'transaction_count',  count(s.id),
    'total_sales',        coalesce(sum(s.total_amount) filter (where not s.is_voided), 0),
    'total_vat',          coalesce(sum(s.vat_amount)   filter (where not s.is_voided), 0),
    'voided_count',       count(s.id) filter (where s.is_voided),
    'cash_total',         coalesce(sum(p.amount) filter (where p.payment_method = 'cash'), 0),
    'mtn_momo_total',     coalesce(sum(p.amount) filter (where p.payment_method = 'mtn_momo'), 0),
    'airtel_money_total', coalesce(sum(p.amount) filter (where p.payment_method = 'airtel_money'), 0)
  )
  into v_result
  from sales s
  left join payments p on p.sale_id = s.id
  where s.created_at::date between p_date_from and p_date_to
    and (v_teller_id is null or s.teller_id = v_teller_id)
    and (
      v_role = 'admin'
      or s.branch_id = coalesce(p_branch_id, v_branch_id)
    );

  return v_result;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 12. REPORTS: Dashboard KPIs (real-time)
-- ════════════════════════════════════════════════════════════
create or replace function get_dashboard_kpis(p_branch_id uuid default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_branch_id  uuid;
  v_today_start timestamptz;
  v_today_end   timestamptz;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied';
  end if;

  v_branch_id  := coalesce(p_branch_id, get_user_branch_id());
  v_today_start := current_date::timestamptz;
  v_today_end   := (current_date + 1)::timestamptz;

  return jsonb_build_object(
    'today_revenue',
    (select coalesce(sum(total_amount), 0) from sales
     where branch_id = v_branch_id
       and created_at >= v_today_start and created_at < v_today_end
       and not is_voided),

    'today_transactions',
    (select count(*) from sales
     where branch_id = v_branch_id
       and created_at >= v_today_start and created_at < v_today_end
       and not is_voided),

    'today_vat',
    (select coalesce(sum(vat_amount), 0) from sales
     where branch_id = v_branch_id
       and created_at >= v_today_start and created_at < v_today_end
       and not is_voided),

    'low_stock_count',
    (select count(distinct product_id) from stock_batches
     where branch_id = v_branch_id
       and quantity_remaining <= 10
       and quantity_remaining > 0),

    'out_of_stock_count',
    (select count(distinct product_id) from products p
     where is_active = true and deleted_at is null
       and not exists (
         select 1 from stock_batches sb
         where sb.product_id = p.id
           and sb.branch_id = v_branch_id
           and sb.quantity_remaining > 0
       )),

    'expiring_soon_count',
    (select count(distinct product_id) from stock_batches
     where branch_id = v_branch_id
       and expiry_date is not null
       and expiry_date between current_date and current_date + 30
       and quantity_remaining > 0),

    'top_products_today',
    (select jsonb_agg(t) from (
       select p.name, sum(si.quantity) as qty_sold, sum(si.line_total) as revenue
       from sale_items si
       join products p on p.id = si.product_id
       join sales s on s.id = si.sale_id
       where s.branch_id = v_branch_id
         and s.created_at >= v_today_start and s.created_at < v_today_end
         and not s.is_voided
       group by p.id, p.name
       order by revenue desc
       limit 10
     ) t),

    'payment_breakdown_today',
    (select jsonb_agg(t) from (
       select payment_method, sum(amount) as total
       from payments pa
       join sales s on s.id = pa.sale_id
       where s.branch_id = v_branch_id
         and s.created_at >= v_today_start and s.created_at < v_today_end
         and not s.is_voided
       group by payment_method
     ) t)
  );
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 13. REPORTS: Sales Report (filterable)
-- ════════════════════════════════════════════════════════════
create or replace function get_sales_report(
  p_date_from  date,
  p_date_to    date,
  p_branch_id  uuid    default null,
  p_teller_id  uuid    default null,
  p_sale_type  text    default null
)
returns table (
  sale_id          uuid,
  sale_number      text,
  sale_date        timestamptz,
  teller_name      text,
  customer_name    text,
  sale_type        sale_type,
  subtotal         numeric,
  vat_amount       numeric,
  total_amount     numeric,
  payment_methods  text,
  is_voided        boolean
)
language plpgsql
security definer
as $$
declare
  v_branch_id uuid;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied';
  end if;

  v_branch_id := coalesce(p_branch_id, get_user_branch_id());

  return query
  select
    s.id,
    s.sale_number,
    s.created_at,
    pr.full_name,
    c.full_name,
    s.sale_type,
    s.subtotal_before_vat,
    s.vat_amount,
    s.total_amount,
    string_agg(distinct p.payment_method::text, ', '),
    s.is_voided
  from sales s
  join profiles pr on pr.id = s.teller_id
  left join customers c on c.id = s.customer_id
  left join payments p on p.sale_id = s.id
  where s.created_at::date between p_date_from and p_date_to
    and s.branch_id = v_branch_id
    and (p_teller_id is null or s.teller_id = p_teller_id)
    and (p_sale_type is null or s.sale_type::text = p_sale_type)
  group by s.id, s.sale_number, s.created_at, pr.full_name, c.full_name,
           s.sale_type, s.subtotal_before_vat, s.vat_amount, s.total_amount, s.is_voided
  order by s.created_at desc;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 14. REPORTS: Stock Valuation (FEFO cost-based)
-- ════════════════════════════════════════════════════════════
create or replace function get_stock_valuation(p_branch_id uuid default null)
returns table (
  product_id       uuid,
  product_name     text,
  category         text,
  total_quantity   numeric,
  total_cost_value numeric,
  total_sale_value numeric,
  expiring_in_30   numeric
)
language plpgsql
security definer
as $$
declare
  v_branch_id uuid;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied';
  end if;

  v_branch_id := coalesce(p_branch_id, get_user_branch_id());

  return query
  select
    p.id,
    p.name,
    cat.name,
    coalesce(sum(sb.quantity_remaining), 0),
    coalesce(sum(sb.quantity_remaining * sb.cost_price_per_unit), 0),
    coalesce(sum(sb.quantity_remaining * pu.selling_price), 0),
    coalesce(sum(sb.quantity_remaining)
      filter (where sb.expiry_date between current_date and current_date + 30), 0)
  from products p
  left join categories cat on cat.id = p.category_id
  left join stock_batches sb on sb.product_id = p.id and sb.branch_id = v_branch_id
  left join product_units pu on pu.id = sb.product_unit_id and pu.is_default = true
  where p.is_active = true and p.deleted_at is null
  group by p.id, p.name, cat.name
  order by p.name;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 15. REPORTS: Expiry Report
-- ════════════════════════════════════════════════════════════
create or replace function get_expiry_report(
  p_days_ahead integer  default 30,
  p_branch_id  uuid     default null
)
returns table (
  product_id    uuid,
  product_name  text,
  batch_id      uuid,
  batch_number  text,
  expiry_date   date,
  days_to_expiry integer,
  quantity      numeric,
  branch_name   text
)
language plpgsql
security definer
as $$
declare
  v_branch_id uuid;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied';
  end if;

  v_branch_id := coalesce(p_branch_id, get_user_branch_id());

  return query
  select
    p.id,
    p.name,
    sb.id,
    sb.batch_number,
    sb.expiry_date,
    (sb.expiry_date - current_date)::integer,
    sb.quantity_remaining,
    b.name
  from stock_batches sb
  join products p on p.id = sb.product_id
  join branches b on b.id = sb.branch_id
  where sb.branch_id = v_branch_id
    and sb.quantity_remaining > 0
    and sb.expiry_date is not null
    and sb.expiry_date <= current_date + p_days_ahead
  order by sb.expiry_date asc;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 16. REPORTS: VAT Report
-- ════════════════════════════════════════════════════════════
create or replace function get_vat_report(
  p_date_from date,
  p_date_to   date,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_branch_id uuid;
  v_result    jsonb;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied';
  end if;

  v_branch_id := coalesce(p_branch_id, get_user_branch_id());

  select jsonb_build_object(
    'period_from',         p_date_from,
    'period_to',           p_date_to,
    'tin',                 '10756690689',
    'total_sales',         coalesce(sum(s.total_amount) filter (where not s.is_voided), 0),
    'total_before_vat',    coalesce(sum(s.subtotal_before_vat) filter (where not s.is_voided), 0),
    'total_vat_collected', coalesce(sum(s.vat_amount) filter (where not s.is_voided), 0),
    'vat_exempt_sales',    coalesce(sum(si.line_total) filter (where si.is_vat_exempt), 0),
    'transaction_count',   count(distinct s.id) filter (where not s.is_voided),
    'daily_breakdown',
    (select jsonb_agg(t) from (
       select s2.created_at::date as sale_date,
              count(s2.id) as transactions,
              sum(s2.total_amount) as total,
              sum(s2.vat_amount) as vat
       from sales s2
       where s2.branch_id = v_branch_id
         and s2.created_at::date between p_date_from and p_date_to
         and not s2.is_voided
       group by s2.created_at::date
       order by s2.created_at::date
     ) t)
  )
  into v_result
  from sales s
  left join sale_items si on si.sale_id = s.id
  where s.branch_id = v_branch_id
    and s.created_at::date between p_date_from and p_date_to;

  return v_result;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 17. RECONCILIATION: Close Daily Reconciliation
-- ════════════════════════════════════════════════════════════
create or replace function close_reconciliation(p_data jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_rec_id         uuid;
  v_expected_cash  numeric;
  v_expected_mtn   numeric;
  v_expected_air   numeric;
  v_denom          jsonb;
  v_actual_cash    numeric := 0;
  v_recon_date     date;
  v_branch_id      uuid;
begin
  if not is_admin_or_manager() then
    raise exception 'Permission denied';
  end if;

  v_recon_date := coalesce((p_data->>'reconciliation_date')::date, current_date);
  v_branch_id  := (p_data->>'branch_id')::uuid;

  -- Calculate expected totals from today's sales
  select
    coalesce(sum(p.amount) filter (where p.payment_method = 'cash'), 0),
    coalesce(sum(p.amount) filter (where p.payment_method = 'mtn_momo'), 0),
    coalesce(sum(p.amount) filter (where p.payment_method = 'airtel_money'), 0)
  into v_expected_cash, v_expected_mtn, v_expected_air
  from payments p
  join sales s on s.id = p.sale_id
  where s.branch_id = v_branch_id
    and s.created_at::date = v_recon_date
    and not s.is_voided;

  -- Calculate actual cash from denomination counts
  select coalesce(sum((d->>'denomination')::integer * (d->>'count')::integer), 0)
  into v_actual_cash
  from jsonb_array_elements(p_data->'denominations') d;

  -- Create or update reconciliation record
  insert into daily_reconciliations (
    branch_id, reconciliation_date,
    expected_cash,       actual_cash,
    expected_mtn_momo,   actual_mtn_momo,
    expected_airtel_money, actual_airtel_money,
    submitted_by, status, notes
  ) values (
    v_branch_id, v_recon_date,
    v_expected_cash, v_actual_cash,
    v_expected_mtn,  (p_data->>'actual_mtn_momo')::numeric,
    v_expected_air,  (p_data->>'actual_airtel_money')::numeric,
    auth.uid(), 'submitted', nullif(p_data->>'notes', '')
  )
  on conflict (branch_id, reconciliation_date)
  do update set
    expected_cash         = excluded.expected_cash,
    actual_cash           = excluded.actual_cash,
    expected_mtn_momo     = excluded.expected_mtn_momo,
    actual_mtn_momo       = excluded.actual_mtn_momo,
    expected_airtel_money = excluded.expected_airtel_money,
    actual_airtel_money   = excluded.actual_airtel_money,
    submitted_by          = excluded.submitted_by,
    submitted_at          = now(),
    status                = 'submitted',
    notes                 = excluded.notes,
    updated_at            = now()
  returning id into v_rec_id;

  -- Save denomination breakdown
  delete from reconciliation_denominations where reconciliation_id = v_rec_id;

  insert into reconciliation_denominations (reconciliation_id, denomination, count)
  select v_rec_id,
         (d->>'denomination')::integer,
         (d->>'count')::integer
  from jsonb_array_elements(p_data->'denominations') d;

  -- Audit
  insert into audit_logs (user_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'close_reconciliation', 'daily_reconciliations', v_rec_id, p_data);

  return jsonb_build_object(
    'success',          true,
    'reconciliation_id', v_rec_id,
    'expected_cash',    v_expected_cash,
    'actual_cash',      v_actual_cash,
    'cash_variance',    v_actual_cash - v_expected_cash
  );
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 18. ADMIN: Create User (admin only, called from Edge Function)
-- ════════════════════════════════════════════════════════════
-- This RPC is called by the Edge Function after auth.admin.createUser()
-- It sets the role in app_metadata and creates the profile
create or replace function admin_setup_new_user(
  p_user_id   uuid,
  p_full_name text,
  p_email     text,
  p_role      user_role,
  p_branch_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  -- Set role in app_metadata (used by RLS helper functions)
  update auth.users
  set raw_app_meta_data = raw_app_meta_data ||
    jsonb_build_object('role', p_role, 'branch_id', p_branch_id)
  where id = p_user_id;

  -- Upsert profile (trigger may have already created it)
  insert into profiles (id, email, full_name, role, branch_id, must_change_password, created_by)
  values (p_user_id, p_email, p_full_name, p_role, p_branch_id, true, auth.uid())
  on conflict (id) do update
  set full_name            = excluded.full_name,
      role                 = excluded.role,
      branch_id            = excluded.branch_id,
      must_change_password = true,
      created_by           = excluded.created_by,
      updated_at           = now();

  -- Audit
  insert into audit_logs (user_id, action, table_name, record_id, new_values)
  values (auth.uid(), 'create_user', 'profiles', p_user_id,
          jsonb_build_object('email', p_email, 'role', p_role));
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 19. PRODUCT: Search products (fuzzy, for POS search bar)
-- ════════════════════════════════════════════════════════════
create or replace function search_products(p_query text, p_branch_id uuid default null)
returns table (
  product_id      uuid,
  unit_id         uuid,
  product_name    text,
  generic_name    text,
  dosage_form     text,
  strength        text,
  barcode         text,
  default_unit    text,
  selling_price   numeric,
  stock_available bigint,
  is_vat_exempt   boolean
)
language plpgsql
security definer stable
as $$
declare
  v_branch_id uuid;
begin
  v_branch_id := coalesce(p_branch_id, get_user_branch_id());

  return query
  select distinct on (p.id, pu.id)
    p.id,
    pu.id,
    p.name::text,
    p.generic_name::text,
    p.dosage_form::text,
    p.strength::text,
    (select pb.barcode from product_barcodes pb where pb.product_id = p.id limit 1)::text,
    pu.unit_name::text,
    pu.selling_price,
    coalesce((
      select sum(sb.quantity_remaining)::bigint
      from stock_batches sb
      where sb.product_id = p.id
        and sb.product_unit_id = pu.id
        and sb.branch_id = v_branch_id
        and sb.quantity_remaining > 0
        and (sb.expiry_date is null or sb.expiry_date >= current_date)
    ), 0::bigint),
    p.is_vat_exempt
  from products p
  join product_units pu on pu.product_id = p.id and pu.is_default = true
  where p.is_active = true and p.deleted_at is null
    and (
      p.name          ilike '%' || p_query || '%'
      or p.generic_name ilike '%' || p_query || '%'
      or exists (select 1 from product_barcodes pb where pb.product_id = p.id and pb.barcode = p_query)
      or p.name % p_query
    )
  order by p.id, pu.id,
    case when exists (select 1 from product_barcodes pb where pb.product_id = p.id and pb.barcode = p_query) then 0 else 1 end,
    similarity(p.name, p_query) desc
  limit 20;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 20. PRODUCT: Lookup by barcode (fast path for scanner)
-- ════════════════════════════════════════════════════════════
create or replace function get_product_by_barcode(p_barcode text, p_branch_id uuid default null)
returns jsonb
language plpgsql
security definer stable
as $$
declare
  v_branch_id uuid;
  v_result    jsonb;
begin
  v_branch_id := coalesce(p_branch_id, get_user_branch_id());

  select jsonb_build_object(
    'product_id',      p.id,
    'name',            p.name,
    'generic_name',    p.generic_name,
    'dosage_form',     p.dosage_form,
    'strength',        p.strength,
    'is_vat_exempt',   p.is_vat_exempt,
    'units',           (
      select jsonb_agg(jsonb_build_object(
        'unit_id',       pu.id,
        'unit_name',     pu.unit_name,
        'selling_price', pu.selling_price,
        'price_before_vat', pu.price_before_vat,
        'vat_amount',    pu.vat_amount,
        'is_default',    pu.is_default,
        'stock',         coalesce((
          select sum(sb2.quantity_remaining)
          from stock_batches sb2
          where sb2.product_id = p.id
            and sb2.product_unit_id = pu.id
            and sb2.branch_id = v_branch_id
            and sb2.quantity_remaining > 0
            and (sb2.expiry_date is null or sb2.expiry_date >= current_date)
        ), 0)
      ) order by pu.is_default desc)
      from product_units pu where pu.product_id = p.id and pu.is_active = true
    )
  )
  into v_result
  from product_barcodes pb
  join products p on p.id = pb.product_id
  where pb.barcode = p_barcode
    and p.is_active = true
    and p.deleted_at is null;

  return v_result;
end;
$$;

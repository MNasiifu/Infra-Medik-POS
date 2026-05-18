-- ============================================================
-- Phase 8 — Report RPCs
-- Run this manually in Supabase SQL Editor
-- ============================================================

-- ─── 1. get_sales_report ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_sales_report(
  p_date_from TEXT,
  p_date_to   TEXT,
  p_branch_id UUID    DEFAULT NULL,
  p_teller_id UUID    DEFAULT NULL,
  p_sale_type TEXT    DEFAULT NULL
)
RETURNS TABLE (
  sale_number          TEXT,
  sale_date            TIMESTAMPTZ,
  teller_name          TEXT,
  customer_name        TEXT,
  sale_type            TEXT,
  items_count          BIGINT,
  subtotal_before_vat  NUMERIC,
  vat_amount           NUMERIC,
  total_amount         NUMERIC,
  payment_methods      TEXT,
  is_voided            BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.sale_number,
    s.created_at,
    pr.full_name,
    c.full_name,
    s.sale_type::TEXT,
    COUNT(si.id),
    s.subtotal_before_vat,
    s.vat_amount,
    s.total_amount,
    COALESCE(
      STRING_AGG(DISTINCT pm.payment_method::TEXT, ', ' ORDER BY pm.payment_method::TEXT),
      ''
    ),
    s.is_voided
  FROM sales s
  LEFT JOIN profiles  pr ON pr.id = s.teller_id
  LEFT JOIN customers c  ON c.id  = s.customer_id
  LEFT JOIN sale_items si ON si.sale_id = s.id
  LEFT JOIN payments  pm ON pm.sale_id = s.id
  WHERE s.created_at >= p_date_from::DATE::TIMESTAMPTZ
    AND s.created_at <  (p_date_to::DATE + INTERVAL '1 day')::TIMESTAMPTZ
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    AND (p_teller_id IS NULL OR s.teller_id = p_teller_id)
    AND (p_sale_type IS NULL OR s.sale_type::TEXT = p_sale_type)
  GROUP BY s.id, pr.full_name, c.full_name
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_report(TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;

-- ─── 2. get_stock_valuation ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_stock_valuation(
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  product_name       TEXT,
  generic_name       TEXT,
  category_name      TEXT,
  unit_name          TEXT,
  batch_number       TEXT,
  expiry_date        DATE,
  quantity_remaining NUMERIC(12,4),          -- fixed: was INTEGER, table is numeric(12,4)
  unit_cost          NUMERIC(12,2),
  batch_value        NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.name,
    pr.generic_name,
    cat.name,
    pu.unit_name,
    sb.batch_number,
    sb.expiry_date,
    sb.quantity_remaining,
    COALESCE(sb.cost_price_per_unit, 0),                              -- fixed: was sb.unit_cost
    sb.quantity_remaining * COALESCE(sb.cost_price_per_unit, 0)      -- fixed: was sb.unit_cost
  FROM stock_batches sb
  JOIN  products      pr  ON pr.id  = sb.product_id
  LEFT JOIN product_units pu  ON pu.product_id = pr.id AND pu.is_default = TRUE
  LEFT JOIN categories    cat ON cat.id = pr.category_id
  WHERE sb.quantity_remaining > 0
    AND (p_branch_id IS NULL OR sb.branch_id = p_branch_id)
  ORDER BY pr.name, sb.expiry_date NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION get_stock_valuation(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_stock_valuation(UUID) TO authenticated;

-- ─── 3. get_expiry_report ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_expiry_report(
  p_days_ahead INTEGER DEFAULT 90,
  p_branch_id  UUID    DEFAULT NULL
)
RETURNS TABLE (
  product_name       TEXT,
  generic_name       TEXT,
  batch_number       TEXT,
  expiry_date        DATE,
  days_until_expiry  INTEGER,
  quantity_remaining NUMERIC(12,4),  -- ← was INTEGER, matches stock_batches
  unit_name          TEXT,
  branch_name        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.name,
    pr.generic_name,
    sb.batch_number,
    sb.expiry_date,
    (sb.expiry_date - CURRENT_DATE)::INTEGER,
    sb.quantity_remaining,
    pu.unit_name,
    br.name
  FROM stock_batches sb
  JOIN  products      pr ON pr.id = sb.product_id
  LEFT JOIN product_units pu ON pu.product_id = pr.id AND pu.is_default = TRUE
  LEFT JOIN branches      br ON br.id = sb.branch_id
  WHERE sb.quantity_remaining > 0
    AND sb.expiry_date IS NOT NULL
    AND sb.expiry_date <= CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL
    AND (p_branch_id IS NULL OR sb.branch_id = p_branch_id)
  ORDER BY sb.expiry_date;
END;
$$;

GRANT EXECUTE ON FUNCTION get_expiry_report(INTEGER, UUID) TO authenticated;

-- ─── 4. get_vat_report ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_vat_report(
  p_date_from TEXT,
  p_date_to   TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start  TIMESTAMPTZ := p_date_from::DATE::TIMESTAMPTZ;
  v_end    TIMESTAMPTZ := (p_date_to::DATE + INTERVAL '1 day')::TIMESTAMPTZ;
  v_by_day JSONB;
  v_result JSONB;
BEGIN
  -- Per-day breakdown
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date',              day_trunc,
      'transaction_count', txn_count,
      'total_sales',       total_sales,
      'vat_amount',        vat_amount
    ) ORDER BY day_trunc
  ), '[]'::jsonb)
  INTO v_by_day
  FROM (
    SELECT
      DATE_TRUNC('day', created_at) AS day_trunc,
      COUNT(*)                      AS txn_count,
      SUM(total_amount)             AS total_sales,
      SUM(vat_amount)               AS vat_amount
    FROM sales
    WHERE is_voided = FALSE
      AND created_at >= v_start
      AND created_at <  v_end
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    GROUP BY DATE_TRUNC('day', created_at)
  ) d;

  -- Aggregate totals
  SELECT jsonb_build_object(
    'date_from',          p_date_from,
    'date_to',            p_date_to,
    'total_sales',        COALESCE(SUM(total_amount), 0),
    'total_before_vat',   COALESCE(SUM(subtotal_before_vat), 0),
    'total_vat',          COALESCE(SUM(vat_amount), 0),
    'vat_rate',           18,
    'transaction_count',  COUNT(*),
    'vat_exempt_total',   COALESCE(SUM(CASE WHEN vat_amount = 0 THEN total_amount ELSE 0 END), 0),
    'by_day',             COALESCE(v_by_day, '[]'::jsonb)
  )
  INTO v_result
  FROM sales
  WHERE is_voided = FALSE
    AND created_at >= v_start
    AND created_at <  v_end
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_vat_report(TEXT, TEXT, UUID) TO authenticated;

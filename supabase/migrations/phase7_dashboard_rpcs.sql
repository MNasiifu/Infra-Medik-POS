-- ============================================================
-- Phase 7 — Dashboard KPIs + Teller Summary RPCs
-- Run this manually in Supabase SQL Editor
-- ============================================================

-- ─── 1. get_dashboard_kpis ───────────────────────────────────────────────────
-- Returns today's revenue, transaction count, VAT, stock alerts, top products
-- and payment breakdown for admin/manager dashboards.
-- p_branch_id: if NULL, returns data for all branches the caller can see.
CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  v_today_end   TIMESTAMPTZ := v_today_start + INTERVAL '1 day';
  v_revenue     NUMERIC     := 0;
  v_txns        BIGINT      := 0;
  v_vat         NUMERIC     := 0;
  v_low_stock   BIGINT      := 0;
  v_out_stock   BIGINT      := 0;
  v_expiring    BIGINT      := 0;
  v_top_products      JSONB;
  v_payment_breakdown JSONB;
BEGIN
  -- ── Today's sales metrics ───────────────────────────────────────────────
  SELECT
    COALESCE(SUM(total_amount), 0),
    COUNT(*),
    COALESCE(SUM(vat_amount), 0)
  INTO v_revenue, v_txns, v_vat
  FROM sales
  WHERE is_voided = FALSE
    AND created_at >= v_today_start
    AND created_at <  v_today_end
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  -- ── Inventory alerts ────────────────────────────────────────────────────
  -- Low stock: batches with 1–9 units remaining
  SELECT COUNT(DISTINCT product_id)
  INTO v_low_stock
  FROM stock_batches
  WHERE quantity_remaining BETWEEN 1 AND 9
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  -- Out of stock: active products with zero total remaining stock
  SELECT COUNT(*)
  INTO v_out_stock
  FROM (
    SELECT p.id
    FROM products p
    WHERE p.is_active = TRUE
      AND COALESCE((
        SELECT SUM(sb.quantity_remaining)
        FROM stock_batches sb
        WHERE sb.product_id = p.id
          AND (p_branch_id IS NULL OR sb.branch_id = p_branch_id)
      ), 0) = 0
  ) sub;

  -- Expiring within 30 days (with stock remaining)
  SELECT COUNT(DISTINCT product_id)
  INTO v_expiring
  FROM stock_batches
  WHERE quantity_remaining > 0
    AND expiry_date IS NOT NULL
    AND expiry_date > CURRENT_DATE
    AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  -- ── Top 5 products today (by revenue) ──────────────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('name', name, 'qty_sold', qty_sold, 'revenue', revenue)
    ORDER BY revenue DESC
  ), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT
      p.name,
      SUM(si.quantity)   AS qty_sold,
      SUM(si.line_total) AS revenue
    FROM sale_items si
    JOIN sales    s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    WHERE s.is_voided = FALSE
      AND s.created_at >= v_today_start
      AND s.created_at <  v_today_end
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY p.id, p.name
    ORDER BY revenue DESC
    LIMIT 5
  ) sub;

  -- ── Payment breakdown today ─────────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('payment_method', payment_method, 'total', total)
    ORDER BY total DESC
  ), '[]'::jsonb)
  INTO v_payment_breakdown
  FROM (
    SELECT
      pm.payment_method,
      SUM(pm.amount) AS total
    FROM payments pm
    JOIN sales s ON s.id = pm.sale_id
    WHERE s.is_voided = FALSE
      AND s.created_at >= v_today_start
      AND s.created_at <  v_today_end
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY pm.payment_method
  ) sub;

  RETURN jsonb_build_object(
    'today_revenue',          v_revenue,
    'today_transactions',     v_txns,
    'today_vat',              v_vat,
    'low_stock_count',        v_low_stock,
    'out_of_stock_count',     v_out_stock,
    'expiring_soon_count',    v_expiring,
    'top_products_today',     v_top_products,
    'payment_breakdown_today', v_payment_breakdown
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_kpis(UUID) TO authenticated;

-- ─── 2. get_teller_summary ───────────────────────────────────────────────────
-- Returns aggregated sales metrics for a single teller over a date range.
-- Defaults to the calling user's own data for today.
CREATE OR REPLACE FUNCTION get_teller_summary(
  p_teller_id UUID    DEFAULT NULL,
  p_date_from TEXT    DEFAULT NULL,
  p_date_to   TEXT    DEFAULT NULL,
  p_branch_id UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teller_id   UUID        := COALESCE(p_teller_id, auth.uid());
  v_date_from   TIMESTAMPTZ := COALESCE(p_date_from::DATE, CURRENT_DATE)::TIMESTAMPTZ;
  v_date_to     TIMESTAMPTZ := (COALESCE(p_date_to::DATE, CURRENT_DATE) + INTERVAL '1 day')::TIMESTAMPTZ;
  v_txn_count   BIGINT      := 0;
  v_total_sales NUMERIC     := 0;
  v_total_vat   NUMERIC     := 0;
  v_voided      BIGINT      := 0;
  v_cash        NUMERIC     := 0;
  v_mtn         NUMERIC     := 0;
  v_airtel      NUMERIC     := 0;
BEGIN
  -- Sales counts
  SELECT
    COUNT(*) FILTER (WHERE NOT is_voided),
    COALESCE(SUM(total_amount) FILTER (WHERE NOT is_voided), 0),
    COALESCE(SUM(vat_amount)   FILTER (WHERE NOT is_voided), 0),
    COUNT(*) FILTER (WHERE is_voided)
  INTO v_txn_count, v_total_sales, v_total_vat, v_voided
  FROM sales
  WHERE teller_id = v_teller_id
    AND created_at >= v_date_from
    AND created_at <  v_date_to
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  -- Payment method totals (non-voided only)
  SELECT
    COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_method = 'cash'),         0),
    COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_method = 'mtn_momo'),     0),
    COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_method = 'airtel_money'), 0)
  INTO v_cash, v_mtn, v_airtel
  FROM payments pm
  JOIN sales s ON s.id = pm.sale_id
  WHERE s.teller_id  = v_teller_id
    AND s.is_voided   = FALSE
    AND s.created_at >= v_date_from
    AND s.created_at <  v_date_to
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);

  RETURN jsonb_build_object(
    'teller_id',         v_teller_id,
    'date_from',         p_date_from,
    'date_to',           p_date_to,
    'transaction_count', v_txn_count,
    'total_sales',       v_total_sales,
    'total_vat',         v_total_vat,
    'voided_count',      v_voided,
    'cash_total',        v_cash,
    'mtn_momo_total',    v_mtn,
    'airtel_money_total', v_airtel
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION get_teller_summary(UUID, TEXT, TEXT, UUID) TO authenticated;

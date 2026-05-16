-- ============================================================
-- Phase 9 — Daily Reconciliation RPCs
-- Run this manually in Supabase SQL Editor
-- ============================================================

-- ─── 1. get_reconciliation_preview ───────────────────────────────────────────
-- Returns expected payment amounts for a given date, derived from actual sales.
-- Called before/during the form so the teller knows the system's expected totals.
CREATE OR REPLACE FUNCTION get_reconciliation_preview(
  p_date      TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date       DATE        := p_date::DATE;
  v_date_start TIMESTAMPTZ := v_date::TIMESTAMPTZ;
  v_date_end   TIMESTAMPTZ := (v_date + INTERVAL '1 day')::TIMESTAMPTZ;
  v_existing   daily_reconciliations%ROWTYPE;
BEGIN
  -- Check if a reconciliation already exists for this date+branch
  SELECT * INTO v_existing
  FROM daily_reconciliations
  WHERE reconciliation_date = v_date
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
  LIMIT 1;

  -- Compute expected amounts from sales payments
  RETURN (
    WITH payment_totals AS (
      SELECT
        COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_method = 'cash'),         0) AS expected_cash,
        COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_method = 'mtn_momo'),     0) AS expected_mtn_momo,
        COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_method = 'airtel_money'), 0) AS expected_airtel_money,
        COUNT(DISTINCT s.id) FILTER (WHERE NOT s.is_voided)                          AS transaction_count
      FROM payments pm
      JOIN sales s ON s.id = pm.sale_id
      WHERE s.is_voided = FALSE
        AND s.created_at >= v_date_start
        AND s.created_at <  v_date_end
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    )
    SELECT jsonb_build_object(
      'reconciliation_date',    p_date,
      'expected_cash',          expected_cash,
      'expected_mtn_momo',      expected_mtn_momo,
      'expected_airtel_money',  expected_airtel_money,
      'total_expected',         expected_cash + expected_mtn_momo + expected_airtel_money,
      'transaction_count',      transaction_count,
      'existing_id',            v_existing.id,
      'existing_status',        v_existing.status,
      'existing_actual_cash',       v_existing.actual_cash,
      'existing_actual_mtn_momo',   v_existing.actual_mtn_momo,
      'existing_actual_airtel',     v_existing.actual_airtel_money,
      'existing_notes',         v_existing.notes
    )
    FROM payment_totals
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_reconciliation_preview(TEXT, UUID) TO authenticated;

-- ─── 2. close_reconciliation ─────────────────────────────────────────────────
-- Creates or updates a daily reconciliation, computes variances, writes audit.
-- p_data shape:
-- {
--   "branch_id":            "uuid",
--   "reconciliation_date":  "2026-05-16",
--   "actual_cash":          250000,
--   "actual_mtn_momo":      125000,
--   "actual_airtel_money":  45000,
--   "notes":                "...",
--   "denominations": [
--     { "denomination": 50000, "count": 3 },
--     ...
--   ]
-- }
CREATE OR REPLACE FUNCTION close_reconciliation(
  p_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID    := auth.uid();
  v_branch_id       UUID    := (p_data->>'branch_id')::UUID;
  v_date            DATE    := (p_data->>'reconciliation_date')::DATE;
  v_date_start      TIMESTAMPTZ := v_date::TIMESTAMPTZ;
  v_date_end        TIMESTAMPTZ := (v_date + INTERVAL '1 day')::TIMESTAMPTZ;
  v_actual_cash     NUMERIC := (p_data->>'actual_cash')::NUMERIC;
  v_actual_mtn      NUMERIC := (p_data->>'actual_mtn_momo')::NUMERIC;
  v_actual_airtel   NUMERIC := (p_data->>'actual_airtel_money')::NUMERIC;
  v_notes           TEXT    := NULLIF(p_data->>'notes', '');

  -- Expected amounts from sales
  v_exp_cash        NUMERIC;
  v_exp_mtn         NUMERIC;
  v_exp_airtel      NUMERIC;

  v_recon_id        UUID;
  v_existing_id     UUID;
  v_denom           JSONB;
BEGIN
  -- Pull expected amounts from sales payments for the date
  SELECT
    COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_method = 'cash'),         0),
    COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_method = 'mtn_momo'),     0),
    COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_method = 'airtel_money'), 0)
  INTO v_exp_cash, v_exp_mtn, v_exp_airtel
  FROM payments pm
  JOIN sales s ON s.id = pm.sale_id
  WHERE s.is_voided = FALSE
    AND s.created_at >= v_date_start
    AND s.created_at <  v_date_end
    AND s.branch_id = v_branch_id;

  -- Check for existing record
  SELECT id INTO v_existing_id
  FROM daily_reconciliations
  WHERE branch_id = v_branch_id
    AND reconciliation_date = v_date
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND (
    SELECT status FROM daily_reconciliations WHERE id = v_existing_id
  ) = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This reconciliation has already been approved and cannot be modified');
  END IF;

  -- Upsert the reconciliation record
  IF v_existing_id IS NULL THEN
    INSERT INTO daily_reconciliations (
      branch_id, reconciliation_date, status,
      expected_cash,         actual_cash,         cash_variance,
      expected_mtn_momo,     actual_mtn_momo,     mtn_momo_variance,
      expected_airtel_money, actual_airtel_money, airtel_variance,
      total_expected, total_actual, total_variance,
      submitted_by, submitted_at, notes
    ) VALUES (
      v_branch_id, v_date, 'submitted',
      v_exp_cash,   v_actual_cash,   v_actual_cash   - v_exp_cash,
      v_exp_mtn,    v_actual_mtn,    v_actual_mtn    - v_exp_mtn,
      v_exp_airtel, v_actual_airtel, v_actual_airtel - v_exp_airtel,
      v_exp_cash + v_exp_mtn + v_exp_airtel,
      v_actual_cash + v_actual_mtn + v_actual_airtel,
      (v_actual_cash + v_actual_mtn + v_actual_airtel) - (v_exp_cash + v_exp_mtn + v_exp_airtel),
      v_user_id, NOW(), v_notes
    )
    RETURNING id INTO v_recon_id;
  ELSE
    UPDATE daily_reconciliations SET
      expected_cash         = v_exp_cash,
      actual_cash           = v_actual_cash,
      cash_variance         = v_actual_cash   - v_exp_cash,
      expected_mtn_momo     = v_exp_mtn,
      actual_mtn_momo       = v_actual_mtn,
      mtn_momo_variance     = v_actual_mtn    - v_exp_mtn,
      expected_airtel_money = v_exp_airtel,
      actual_airtel_money   = v_actual_airtel,
      airtel_variance       = v_actual_airtel - v_exp_airtel,
      total_expected        = v_exp_cash + v_exp_mtn + v_exp_airtel,
      total_actual          = v_actual_cash + v_actual_mtn + v_actual_airtel,
      total_variance        = (v_actual_cash + v_actual_mtn + v_actual_airtel) - (v_exp_cash + v_exp_mtn + v_exp_airtel),
      status                = 'submitted',
      submitted_by          = v_user_id,
      submitted_at          = NOW(),
      notes                 = v_notes,
      updated_at            = NOW()
    WHERE id = v_existing_id
    RETURNING id INTO v_recon_id;
  END IF;

  -- Denomination breakdown — delete old rows, re-insert
  DELETE FROM reconciliation_denominations WHERE reconciliation_id = v_recon_id;

  FOR v_denom IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'denominations', '[]'::jsonb))
  LOOP
    IF (v_denom->>'count')::INTEGER > 0 THEN
      INSERT INTO reconciliation_denominations (reconciliation_id, denomination, count, total_amount)
      VALUES (
        v_recon_id,
        (v_denom->>'denomination')::NUMERIC,
        (v_denom->>'count')::INTEGER,
        (v_denom->>'denomination')::NUMERIC * (v_denom->>'count')::INTEGER
      );
    END IF;
  END LOOP;

  -- Audit log
  INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (
    v_user_id, 'close_reconciliation', 'daily_reconciliations', v_recon_id,
    jsonb_build_object(
      'date',           p_data->>'reconciliation_date',
      'total_actual',   v_actual_cash + v_actual_mtn + v_actual_airtel,
      'total_variance', (v_actual_cash + v_actual_mtn + v_actual_airtel) - (v_exp_cash + v_exp_mtn + v_exp_airtel)
    )
  );

  RETURN jsonb_build_object(
    'success',          TRUE,
    'reconciliation_id', v_recon_id,
    'total_expected',   v_exp_cash + v_exp_mtn + v_exp_airtel,
    'total_actual',     v_actual_cash + v_actual_mtn + v_actual_airtel,
    'total_variance',   (v_actual_cash + v_actual_mtn + v_actual_airtel) - (v_exp_cash + v_exp_mtn + v_exp_airtel)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION close_reconciliation(JSONB) TO authenticated;

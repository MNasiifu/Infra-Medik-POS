-- ============================================================
-- INFRA MEDIK POS — Phase 10: EFRIS Helper RPCs
-- Run in Supabase SQL Editor
-- ============================================================

-- Called by the efris-submit Edge Function after URA responds.
-- Atomically inserts an efris_submissions row and updates the sale's EFRIS fields.

CREATE OR REPLACE FUNCTION record_efris_result(
  p_sale_id           UUID,
  p_status            TEXT,                     -- 'submitted' | 'failed'
  p_verification_code TEXT    DEFAULT NULL,
  p_qr_data           TEXT    DEFAULT NULL,
  p_request_payload   JSONB   DEFAULT NULL,
  p_response_payload  JSONB   DEFAULT NULL,
  p_error             TEXT    DEFAULT NULL,
  p_retry_count       INT     DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO efris_submissions (
    sale_id, submission_type,
    request_payload, response_payload,
    status, verification_code, qr_data,
    retry_count, error_message, submitted_at
  ) VALUES (
    p_sale_id, 'sale',
    p_request_payload, p_response_payload,
    p_status::efris_status, p_verification_code, p_qr_data,
    p_retry_count, p_error,
    CASE WHEN p_status = 'submitted' THEN now() ELSE NULL END
  );

  UPDATE sales
  SET
    efris_status            = p_status::efris_status,
    efris_verification_code = p_verification_code,
    efris_qr_data           = p_qr_data
  WHERE id = p_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_efris_result TO service_role;

-- ─── Retry helper ────────────────────────────────────────────
-- Lists all sales stuck in 'pending' or 'failed' EFRIS status
-- so an admin dashboard or cron can re-submit them.
CREATE OR REPLACE FUNCTION get_efris_pending_sales(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  sale_id            UUID,
  sale_number        TEXT,
  total_amount       NUMERIC,
  created_at         TIMESTAMPTZ,
  efris_status       efris_status,
  last_error         TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    s.id,
    s.sale_number,
    s.total_amount,
    s.created_at,
    s.efris_status,
    (SELECT error_message FROM efris_submissions WHERE sale_id = s.id ORDER BY created_at DESC LIMIT 1)
  FROM sales s
  WHERE s.efris_status IN ('pending', 'failed')
    AND s.is_voided = FALSE
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_efris_pending_sales TO authenticated;

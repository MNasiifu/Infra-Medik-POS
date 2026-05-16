-- Migration 016: Update search_products to return unit_id (UUID) in the result set.
-- The frontend ProductSearchResult type now expects unit_id so the cart can pass
-- the correct product_unit_id to complete_sale.
--
-- Run manually in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION search_products(
  p_query     text,
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
BEGIN
  -- Resolve branch: use provided or fall back to caller's branch
  v_branch_id := COALESCE(p_branch_id, get_user_branch_id());

  RETURN QUERY
  SELECT DISTINCT ON (p.id, pu.id)
    p.id                                              AS product_id,
    pu.id                                             AS unit_id,
    p.name::text                                      AS product_name,
    p.generic_name::text,
    p.dosage_form::text,
    p.strength::text,
    -- Return first matching barcode (or NULL)
    (SELECT pb.barcode FROM product_barcodes pb
     WHERE pb.product_id = p.id LIMIT 1)             AS barcode,
    pu.unit_name::text                                AS default_unit,
    pu.selling_price,
    -- Available stock across all batches for this branch + unit
    COALESCE((
      SELECT SUM(sb.quantity_remaining)
      FROM stock_batches sb
      WHERE sb.product_id = p.id
        AND sb.product_unit_id = pu.id
        AND (v_branch_id IS NULL OR sb.branch_id = v_branch_id)
        AND sb.quantity_remaining > 0
    ), 0)                                             AS stock_available,
    p.is_vat_exempt
  FROM products p
  JOIN product_units pu ON pu.product_id = p.id
  WHERE
    p.deleted_at IS NULL
    AND p.is_active = true
    AND pu.is_active = true
    AND (
      -- Barcode exact match (highest priority)
      EXISTS (
        SELECT 1 FROM product_barcodes pb
        WHERE pb.product_id = p.id
          AND pb.barcode = p_query
      )
      -- Trigram fuzzy match on name or generic name
      OR p.name         % p_query
      OR p.generic_name % p_query
      -- Prefix / ILIKE fallback for short queries
      OR p.name         ILIKE p_query || '%'
      OR p.generic_name ILIKE p_query || '%'
    )
  ORDER BY
    p.id,
    pu.id,
    -- Prefer the default unit
    pu.is_default DESC,
    -- Prefer exact barcode matches
    CASE WHEN EXISTS (
      SELECT 1 FROM product_barcodes pb
      WHERE pb.product_id = p.id AND pb.barcode = p_query
    ) THEN 0 ELSE 1 END,
    -- Trigram similarity
    similarity(p.name, p_query) DESC
  LIMIT 30;
END;
$$;

-- Also update get_product_by_barcode to return unit_id
CREATE OR REPLACE FUNCTION get_product_by_barcode(
  p_barcode   text,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
  v_result    jsonb;
BEGIN
  v_branch_id := COALESCE(p_branch_id, get_user_branch_id());

  SELECT jsonb_build_object(
    'product_id',      p.id,
    'unit_id',         pu.id,
    'product_name',    p.name,
    'generic_name',    p.generic_name,
    'dosage_form',     p.dosage_form,
    'strength',        p.strength,
    'barcode',         pb.barcode,
    'default_unit',    pu.unit_name,
    'selling_price',   pu.selling_price,
    'stock_available', COALESCE((
      SELECT SUM(sb.quantity_remaining)
      FROM stock_batches sb
      WHERE sb.product_id = p.id
        AND sb.product_unit_id = pu.id
        AND (v_branch_id IS NULL OR sb.branch_id = v_branch_id)
        AND sb.quantity_remaining > 0
    ), 0),
    'is_vat_exempt',   p.is_vat_exempt
  )
  INTO v_result
  FROM product_barcodes pb
  JOIN products     p  ON p.id  = pb.product_id
  JOIN product_units pu ON pu.product_id = p.id AND pu.is_default = true
  WHERE pb.barcode    = p_barcode
    AND p.deleted_at IS NULL
    AND p.is_active   = true
    AND pu.is_active  = true
  LIMIT 1;

  RETURN v_result;
END;
$$;

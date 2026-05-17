import { z } from 'zod'

export const ADJUSTMENT_TYPES = [
  'damage', 'expiry', 'theft', 'correction', 'return_to_supplier', 'other',
] as const

export const ADJUSTMENT_LABELS: Record<string, string> = {
  damage:             'Damage',
  expiry:             'Expiry',
  theft:              'Theft',
  correction:         'Correction',
  return_to_supplier: 'Return to Supplier',
  other:              'Other',
}

// ─── Stock Adjustment Form ──────────────────────────────────
export const stockAdjustmentSchema = z.object({
  product_id:      z.string().uuid('Select a product'),
  batch_id:        z.string().uuid('Select a batch'),
  adjustment_type: z.enum(ADJUSTMENT_TYPES, { required_error: 'Select adjustment type' }),
  quantity:        z.coerce.number().refine((v) => v !== 0, 'Quantity cannot be zero'),
  reason:          z.string().min(3, 'Reason must be at least 3 characters').max(500),
})

export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>

// ─── Stock Batch Edit Form ──────────────────────────────────
export const stockBatchEditSchema = z.object({
  batch_number:        z.string().min(1, 'Batch number is required').max(100),
  expiry_date:         z.string().nullable(),
  cost_price_per_unit: z.coerce.number().min(0, 'Cost must be 0 or greater'),
})

export type StockBatchEditFormValues = z.infer<typeof stockBatchEditSchema>

// ─── Purchase Order Form ────────────────────────────────────
export const poItemSchema = z.object({
  product_id:          z.string().uuid('Select a product'),
  product_unit_id:     z.string().uuid('Select a unit'),
  quantity_ordered:    z.coerce.number().positive('Quantity must be positive'),
  cost_price_per_unit: z.coerce.number().min(0, 'Cost must be 0 or greater'),
})

export type POItemFormValues = z.infer<typeof poItemSchema>

export const purchaseOrderSchema = z.object({
  supplier_id:            z.string().uuid('Select a supplier'),
  expected_delivery_date: z.string().nullable(),
  notes:                  z.string().max(500).nullable(),
  items:                  z.array(poItemSchema).min(1, 'Add at least one item'),
})

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>

// ─── Stock Receiving Form ───────────────────────────────────
export const receivingItemSchema = z.object({
  product_id:             z.string().uuid('Select a product'),
  product_unit_id:        z.string().uuid('Select a unit'),
  purchase_order_item_id: z.string().uuid().nullable().optional(),
  batch_number:           z.string().min(1, 'Batch number required'),
  expiry_date:            z.string().nullable(),
  quantity_received:      z.coerce.number().positive('Quantity must be positive'),
  cost_price_per_unit:    z.coerce.number().min(0, 'Cost must be 0 or greater'),
})

export type ReceivingItemFormValues = z.infer<typeof receivingItemSchema>

export const stockReceivingSchema = z.object({
  supplier_id:       z.string().uuid().nullable(),
  purchase_order_id: z.string().uuid().nullable(),
  notes:             z.string().max(500).nullable(),
  items:             z.array(receivingItemSchema).min(1, 'Add at least one item'),
})

export type StockReceivingFormValues = z.infer<typeof stockReceivingSchema>

// ─── Stock Take ─────────────────────────────────────────────
export const stockTakeCreateSchema = z.object({
  notes: z.string().max(500).optional(),
})

export type StockTakeCreateFormValues = z.infer<typeof stockTakeCreateSchema>

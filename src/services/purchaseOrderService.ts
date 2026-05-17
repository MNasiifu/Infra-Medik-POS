import { supabase } from '@/lib/supabase'
import type {
  PurchaseOrder, PurchaseOrderItem, Product,
  ProductUnit, Supplier, Profile, POStatus,
} from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Join types ─────────────────────────────────────────────
export interface PurchaseOrderWithDetails extends PurchaseOrder {
  suppliers:    Pick<Supplier, 'id' | 'name'> | null
  created_by_profile: Pick<Profile, 'id' | 'full_name'> | null
}

export interface POItemWithDetails extends PurchaseOrderItem {
  products:      Pick<Product, 'id' | 'name' | 'generic_name'> | null
  product_units: Pick<ProductUnit, 'id' | 'unit_name'> | null
}

export interface PurchaseOrderFull extends PurchaseOrderWithDetails {
  purchase_order_items: POItemWithDetails[]
}

export interface CreatePOPayload {
  branch_id:              string
  supplier_id:            string
  expected_delivery_date: string | null
  notes:                  string | null
  items: Array<{
    product_id:          string
    product_unit_id:     string
    quantity_ordered:    number
    cost_price_per_unit: number
  }>
}

// ─── Select constants ───────────────────────────────────────
const PO_LIST_SELECT = `
  *,
  suppliers(id, name),
  created_by_profile:profiles!created_by(id, full_name)
` as const

const PO_DETAIL_SELECT = `
  *,
  suppliers(id, name),
  created_by_profile:profiles!created_by(id, full_name),
  purchase_order_items(
    *,
    products(id, name, generic_name),
    product_units(id, unit_name)
  )
` as const

// ─── Service ────────────────────────────────────────────────
export const purchaseOrderService = {

  async getAll(branchId: string | null): Promise<PurchaseOrderWithDetails[]> {
    let query = db
      .from('purchase_orders')
      .select(PO_LIST_SELECT)
      .order('created_at', { ascending: false })
      .limit(200)

    if (branchId) query = query.eq('branch_id', branchId)

    const { data, error } = await query
    if (error) throw error
    return data as PurchaseOrderWithDetails[]
  },

  async getById(id: string): Promise<PurchaseOrderFull> {
    const { data, error } = await db
      .from('purchase_orders')
      .select(PO_DETAIL_SELECT)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as PurchaseOrderFull
  },

  async create(payload: CreatePOPayload): Promise<PurchaseOrder> {
    // Generate PO number via RPC
    const { data: poNumber, error: numErr } = await db.rpc('generate_po_number')
    if (numErr) throw numErr

    const subtotal = payload.items.reduce(
      (sum, i) => sum + i.quantity_ordered * i.cost_price_per_unit, 0,
    )

    // Insert PO header
    const { data: po, error: poErr } = await db
      .from('purchase_orders')
      .insert({
        branch_id:              payload.branch_id,
        supplier_id:            payload.supplier_id,
        po_number:              poNumber,
        status:                 'draft',
        expected_delivery_date: payload.expected_delivery_date || null,
        notes:                  payload.notes || null,
        subtotal,
        created_by:             (await supabase.auth.getUser()).data.user?.id,
      })
      .select('*')
      .single()
    if (poErr) throw poErr

    // Insert PO items
    const items = payload.items.map((item) => ({
      purchase_order_id:  po.id,
      product_id:         item.product_id,
      product_unit_id:    item.product_unit_id,
      quantity_ordered:   item.quantity_ordered,
      cost_price_per_unit: item.cost_price_per_unit,
    }))

    const { error: itemsErr } = await db
      .from('purchase_order_items')
      .insert(items)
    if (itemsErr) throw itemsErr

    return po as PurchaseOrder
  },

  async updateStatus(id: string, status: POStatus): Promise<void> {
    const { error } = await db
      .from('purchase_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async deleteDraft(id: string): Promise<void> {
    const { error } = await db
      .from('purchase_orders')
      .delete()
      .eq('id', id)
      .eq('status', 'draft')
    if (error) throw error
  },
}

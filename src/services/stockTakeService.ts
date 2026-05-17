import { supabase } from '@/lib/supabase'
import type {
  StockTake, StockTakeItem, Product,
  StockBatch, Profile, StockTakeStatus,
} from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Join types ─────────────────────────────────────────────
export interface StockTakeWithDetails extends StockTake {
  started_by_profile:   Pick<Profile, 'id' | 'full_name'> | null
  completed_by_profile: Pick<Profile, 'id' | 'full_name'> | null
  item_count:           number
}

export interface StockTakeItemWithDetails extends StockTakeItem {
  products:      Pick<Product, 'id' | 'name' | 'generic_name'> | null
  stock_batches: Pick<StockBatch, 'id' | 'batch_number' | 'expiry_date' | 'quantity_remaining'> | null
}

export interface StockTakeFull extends StockTake {
  started_by_profile:   Pick<Profile, 'id' | 'full_name'> | null
  completed_by_profile: Pick<Profile, 'id' | 'full_name'> | null
  stock_take_items:     StockTakeItemWithDetails[]
}

// ─── Select constants ───────────────────────────────────────
const LIST_SELECT = `
  *,
  started_by_profile:profiles!started_by(id, full_name),
  completed_by_profile:profiles!completed_by(id, full_name),
  stock_take_items(id)
` as const

const DETAIL_SELECT = `
  *,
  started_by_profile:profiles!started_by(id, full_name),
  completed_by_profile:profiles!completed_by(id, full_name),
  stock_take_items(
    *,
    products(id, name, generic_name),
    stock_batches(id, batch_number, expiry_date, quantity_remaining)
  )
` as const

// ─── Service ────────────────────────────────────────────────
export const stockTakeService = {

  async getAll(branchId: string | null): Promise<StockTakeWithDetails[]> {
    let query = db
      .from('stock_takes')
      .select(LIST_SELECT)
      .order('created_at', { ascending: false })
      .limit(100)

    if (branchId) query = query.eq('branch_id', branchId)

    const { data, error } = await query
    if (error) throw error

    // Map item count from nested array
    return (data as any[]).map((st) => ({
      ...st,
      item_count: st.stock_take_items?.length ?? 0,
      stock_take_items: undefined,
    })) as StockTakeWithDetails[]
  },

  async getById(id: string): Promise<StockTakeFull> {
    const { data, error } = await db
      .from('stock_takes')
      .select(DETAIL_SELECT)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as StockTakeFull
  },

  async create(branchId: string, notes?: string): Promise<StockTake> {
    const userId = (await supabase.auth.getUser()).data.user?.id
    const { data, error } = await db
      .from('stock_takes')
      .insert({
        branch_id:  branchId,
        status:     'draft',
        notes:      notes || null,
        started_by: userId,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as StockTake
  },

  async addItem(payload: {
    stock_take_id:   string
    product_id:      string
    batch_id:        string | null
    system_quantity: number
  }): Promise<StockTakeItem> {
    const { data, error } = await db
      .from('stock_take_items')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as StockTakeItem
  },

  async updateItemCount(itemId: string, countedQuantity: number, notes?: string): Promise<void> {
    const { error } = await db
      .from('stock_take_items')
      .update({ counted_quantity: countedQuantity, notes: notes || null })
      .eq('id', itemId)
    if (error) throw error
  },

  async removeItem(itemId: string): Promise<void> {
    const { error } = await db
      .from('stock_take_items')
      .delete()
      .eq('id', itemId)
    if (error) throw error
  },

  async updateStatus(id: string, status: StockTakeStatus): Promise<void> {
    const { error } = await db
      .from('stock_takes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async complete(id: string): Promise<{ success: boolean }> {
    const { data, error } = await db.rpc('complete_stock_take', {
      p_stock_take_id: id,
    })
    if (error) throw error
    const result = data as { success: boolean; error?: string }
    if (!result.success) throw new Error(result.error ?? 'Failed to complete stock take')
    return result
  },

  async deleteDraft(id: string): Promise<void> {
    const { error } = await db
      .from('stock_takes')
      .delete()
      .eq('id', id)
      .eq('status', 'draft')
    if (error) throw error
  },
}

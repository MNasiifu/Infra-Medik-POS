import { supabase } from '@/lib/supabase'
import type { Supplier } from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface SupplierFilters {
  search?: string
  showInactive?: boolean
}

export const supplierService = {
  async getAll(filters: SupplierFilters = {}): Promise<Supplier[]> {
    let query = db.from('suppliers').select('*').order('name')
    if (!filters.showInactive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error

    if (filters.search) {
      const q = filters.search.toLowerCase()
      return (data as Supplier[]).filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.contact_person?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q),
      )
    }
    return data as Supplier[]
  },

  async create(
    data: Omit<Supplier, 'id' | 'is_active' | 'created_at' | 'updated_at'>,
  ): Promise<Supplier> {
    const { data: result, error } = await db
      .from('suppliers')
      .insert({ ...data, is_active: true })
      .select()
      .single()
    if (error) throw error
    return result as Supplier
  },

  async update(
    id: string,
    data: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Supplier> {
    const { data: result, error } = await db
      .from('suppliers')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return result as Supplier
  },

  async deactivate(id: string): Promise<void> {
    const { error } = await db.from('suppliers').update({ is_active: false }).eq('id', id)
    if (error) throw error
  },
}

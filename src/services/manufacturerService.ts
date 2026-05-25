import { supabase } from '@/lib/supabase'
import type { Country, Manufacturer } from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type ManufacturerWithCountry = Manufacturer & {
  countries: Pick<Country, 'id' | 'name'> | null
}

export interface ManufacturerFilters {
  search?: string
  showInactive?: boolean
}

export const manufacturerService = {
  async getAll(filters: ManufacturerFilters = {}): Promise<ManufacturerWithCountry[]> {
    let query = db
      .from('manufacturers')
      .select('*, countries(id, name)')
      .order('name')
    if (!filters.showInactive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error

    const rows = data as ManufacturerWithCountry[]
    if (filters.search) {
      const q = filters.search.toLowerCase()
      return rows.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.countries?.name.toLowerCase().includes(q),
      )
    }
    return rows
  },

  async create(data: {
    name: string
    country_id?: string | null
    website?: string | null
  }): Promise<Manufacturer> {
    const { data: result, error } = await db
      .from('manufacturers')
      .insert({
        name: data.name,
        country_id: data.country_id || null,
        website: data.website || null,
        is_active: true,
      })
      .select()
      .single()
    if (error) throw error
    return result as Manufacturer
  },

  async update(
    id: string,
    data: Partial<Pick<Manufacturer, 'name' | 'country_id' | 'website' | 'is_active'>>,
  ): Promise<Manufacturer> {
    const { data: result, error } = await db
      .from('manufacturers')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return result as Manufacturer
  },

  async deactivate(id: string): Promise<void> {
    const { error } = await db.from('manufacturers').update({ is_active: false }).eq('id', id)
    if (error) throw error
  },
}

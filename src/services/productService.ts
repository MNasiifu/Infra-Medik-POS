import { supabase } from '@/lib/supabase'
import type {
  Product, ProductUnit, ProductBarcode,
  Category, Manufacturer, Country, Supplier,
} from '@/types/database.types'

// Our Database type uses named TypeScript interfaces for Row/Insert/Update which don't
// satisfy Supabase's internal Record<string,unknown> constraint at the type level.
// All service methods still have explicit typed return types — runtime is fully correct.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Join type used throughout the product module ─────────────
export interface ProductWithDetails extends Product {
  categories:      Pick<Category,     'id' | 'name'> | null
  manufacturers:   Pick<Manufacturer, 'id' | 'name'> | null
  countries:       Pick<Country,      'id' | 'name' | 'code'> | null
  suppliers:       Pick<Supplier,     'id' | 'name'> | null
  product_units:   ProductUnit[]
  product_barcodes: Pick<ProductBarcode, 'id' | 'barcode' | 'is_generated'>[]
}

const PRODUCT_SELECT = `
  *,
  categories(id, name),
  manufacturers(id, name),
  countries(id, name, code),
  suppliers(id, name),
  product_units(*),
  product_barcodes(id, barcode, is_generated)
` as const

export interface ProductFilters {
  search?:       string
  categoryId?:   string
  manufacturerId?: string
  dosageForm?:   string
  isVatExempt?:  boolean
  showInactive?: boolean
}

// ─── Product CRUD ─────────────────────────────────────────────
export const productService = {

  async getAll(filters: ProductFilters = {}): Promise<ProductWithDetails[]> {
    let query = db
      .from('products')
      .select(PRODUCT_SELECT)
      .is('deleted_at', null)
      .order('name')

    if (filters.showInactive === false) query = query.eq('is_active', true)
    if (filters.categoryId)    query = query.eq('category_id', filters.categoryId)
    if (filters.manufacturerId) query = query.eq('manufacturer_id', filters.manufacturerId)
    if (filters.dosageForm)    query = query.eq('dosage_form', filters.dosageForm)
    if (filters.isVatExempt !== undefined) query = query.eq('is_vat_exempt', filters.isVatExempt)

    // Client-side fuzzy filter when search is provided (for quick filtering; RPC handles POS search)
    const { data, error } = await query
    if (error) throw error

    if (filters.search) {
      const q = filters.search.toLowerCase()
      return (data as ProductWithDetails[]).filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.generic_name ?? '').toLowerCase().includes(q) ||
          p.product_barcodes.some((b) => b.barcode.includes(q))
      )
    }

    return data as ProductWithDetails[]
  },

  async getById(id: string): Promise<ProductWithDetails> {
    const { data, error } = await db
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as ProductWithDetails
  },

  async create(
    product:  Omit<Product,     'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
    units:    Omit<ProductUnit, 'id' | 'selling_price' | 'created_at' | 'updated_at' | 'product_id'>[],
    barcodes: { barcode: string; is_generated: boolean }[]
  ): Promise<ProductWithDetails> {
    // 1. Insert product
    const { data: prod, error: prodErr } = await db
      .from('products')
      .insert(product)
      .select()
      .single()
    if (prodErr) throw prodErr

    // 2. Insert units
    if (units.length > 0) {
      const { error: unitsErr } = await db
        .from('product_units')
        .insert(units.map((u) => ({ ...u, product_id: prod.id })))
      if (unitsErr) {
        await db.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', prod.id)
        throw unitsErr
      }
    }

    // 3. Insert barcodes
    if (barcodes.length > 0) {
      await db
        .from('product_barcodes')
        .insert(barcodes.map((b) => ({ ...b, product_id: prod.id })))
    }

    return productService.getById(prod.id)
  },

  async update(id: string, data: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<ProductWithDetails> {
    const { error } = await db
      .from('products')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return productService.getById(id)
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await db
      .from('products')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
    if (error) throw error
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await db
      .from('products')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) throw error
  },

  // ─── Product Units ─────────────────────────────────────────
  async addUnit(productId: string, unit: Omit<ProductUnit, 'id' | 'selling_price' | 'created_at' | 'updated_at' | 'product_id'>): Promise<ProductUnit> {
    const { data, error } = await db
      .from('product_units')
      .insert({ ...unit, product_id: productId })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateUnit(unitId: string, data: Partial<Omit<ProductUnit, 'id' | 'product_id'>>): Promise<ProductUnit> {
    const { data: updated, error } = await db
      .from('product_units')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', unitId)
      .select()
      .single()
    if (error) throw error
    return updated
  },

  async deleteUnit(unitId: string): Promise<void> {
    const { error } = await db.from('product_units').delete().eq('id', unitId)
    if (error) throw error
  },

  async setDefaultUnit(productId: string, unitId: string): Promise<void> {
    // Remove default from all units first, then set new default
    await db
      .from('product_units')
      .update({ is_default: false })
      .eq('product_id', productId)

    const { error } = await db
      .from('product_units')
      .update({ is_default: true })
      .eq('id', unitId)
    if (error) throw error
  },

  // ─── Barcodes ─────────────────────────────────────────────
  async addBarcode(productId: string, barcode: string, isGenerated: boolean): Promise<ProductBarcode> {
    const { data, error } = await db
      .from('product_barcodes')
      .insert({ product_id: productId, barcode, is_generated: isGenerated })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteBarcode(barcodeId: string): Promise<void> {
    const { error } = await db.from('product_barcodes').delete().eq('id', barcodeId)
    if (error) throw error
  },

  // ─── Reference data ────────────────────────────────────────
  async getCategories(): Promise<Category[]> {
    const { data, error } = await db
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return data
  },

  async createCategory(name: string, description?: string): Promise<Category> {
    const { data, error } = await db
      .from('categories')
      .insert({ name, description: description ?? null })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getManufacturers(): Promise<(Manufacturer & { countries: Pick<Country, 'id' | 'name'> | null })[]> {
    const { data, error } = await db
      .from('manufacturers')
      .select('*, countries(id, name)')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return data as (Manufacturer & { countries: Pick<Country, 'id' | 'name'> | null })[]
  },

  async createManufacturer(name: string, countryId?: string): Promise<Manufacturer> {
    const { data, error } = await db
      .from('manufacturers')
      .insert({ name, country_id: countryId ?? null })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getCountries(): Promise<Country[]> {
    const { data, error } = await db
      .from('countries')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return data
  },

  async getSuppliers(): Promise<Supplier[]> {
    const { data, error } = await db
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return data
  },

  async getCurrentVatRate(): Promise<number> {
    const { data, error } = await db.rpc('get_current_vat_rate')
    if (error) throw error
    return (data as number) ?? 18
  },
}

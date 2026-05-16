import { supabase } from '@/lib/supabase'
import type { SaleType } from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Row types ────────────────────────────────────────────────────────────────

export interface SalesReportRow {
  sale_number:         string
  sale_date:           string
  teller_name:         string | null
  customer_name:       string | null
  sale_type:           SaleType
  items_count:         number
  subtotal_before_vat: number
  vat_amount:          number
  total_amount:        number
  payment_methods:     string
  is_voided:           boolean
}

export interface StockValuationRow {
  product_name:       string
  generic_name:       string | null
  category_name:      string | null
  unit_name:          string | null
  batch_number:       string | null
  expiry_date:        string | null
  quantity_remaining: number
  unit_cost:          number
  batch_value:        number
}

export interface ExpiryReportRow {
  product_name:       string
  generic_name:       string | null
  batch_number:       string | null
  expiry_date:        string
  days_until_expiry:  number
  quantity_remaining: number
  unit_name:          string | null
  branch_name:        string | null
}

export interface VatByDay {
  date:              string
  transaction_count: number
  total_sales:       number
  vat_amount:        number
}

export interface VatReportData {
  date_from:         string
  date_to:           string
  total_sales:       number
  total_before_vat:  number
  total_vat:         number
  vat_rate:          number
  transaction_count: number
  vat_exempt_total:  number
  by_day:            VatByDay[]
}

export interface TellerOption {
  id:        string
  full_name: string
}

// ─── Filter types ─────────────────────────────────────────────────────────────

export interface SalesReportFilters {
  dateFrom:  string
  dateTo:    string
  branchId?: string | null
  tellerId?: string | null
  saleType?: SaleType | ''
}

export interface StockValuationFilters {
  branchId?: string | null
}

export interface ExpiryReportFilters {
  daysAhead: number
  branchId?: string | null
}

export interface VatReportFilters {
  dateFrom:  string
  dateTo:    string
  branchId?: string | null
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const reportService = {

  async getSalesReport(f: SalesReportFilters): Promise<SalesReportRow[]> {
    const { data, error } = await db.rpc('get_sales_report', {
      p_date_from: f.dateFrom,
      p_date_to:   f.dateTo,
      p_branch_id: f.branchId  ?? null,
      p_teller_id: f.tellerId  ?? null,
      p_sale_type: f.saleType  || null,
    })
    if (error) throw error
    return (data ?? []) as SalesReportRow[]
  },

  async getStockValuation(f: StockValuationFilters = {}): Promise<StockValuationRow[]> {
    const { data, error } = await db.rpc('get_stock_valuation', {
      p_branch_id: f.branchId ?? null,
    })
    if (error) throw error
    return (data ?? []) as StockValuationRow[]
  },

  async getExpiryReport(f: ExpiryReportFilters): Promise<ExpiryReportRow[]> {
    const { data, error } = await db.rpc('get_expiry_report', {
      p_days_ahead: f.daysAhead,
      p_branch_id:  f.branchId ?? null,
    })
    if (error) throw error
    return (data ?? []) as ExpiryReportRow[]
  },

  async getVatReport(f: VatReportFilters): Promise<VatReportData> {
    const { data, error } = await db.rpc('get_vat_report', {
      p_date_from: f.dateFrom,
      p_date_to:   f.dateTo,
      p_branch_id: f.branchId ?? null,
    })
    if (error) throw error
    return data as VatReportData
  },

  async getTellers(): Promise<TellerOption[]> {
    const { data, error } = await db
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'manager', 'teller'])
      .eq('is_active', true)
      .order('full_name')
    if (error) throw error
    return (data ?? []) as TellerOption[]
  },
}

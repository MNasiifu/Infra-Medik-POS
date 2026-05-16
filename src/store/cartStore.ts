import { create } from 'zustand'
import type { ProductSearchResult } from '@/types/database.types'
import { computeLineTotal } from '@/lib/vat'

export interface CartLine {
  productId: string
  productName: string
  genericName: string | null
  unitId: string
  unitName: string
  barcode: string | null
  quantity: number
  unitPriceInclusive: number
  unitPriceBeforeVat: number
  vatPerUnit: number
  lineTotal: number
  lineTotalBeforeVat: number
  lineVat: number
  isVatExempt: boolean
}

interface CartState {
  lines: CartLine[]
  customerId: string | null
  customerName: string | null

  addProduct: (product: ProductSearchResult, qty?: number) => void
  updateQuantity: (productId: string, unitId: string, qty: number) => void
  removeLine: (productId: string, unitId: string) => void
  setCustomer: (id: string | null, name: string | null) => void
  clearCart: () => void

  // Totals
  subtotalBeforeVat: () => number
  totalVat: () => number
  grandTotal: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  customerId: null,
  customerName: null,

  addProduct: (product, qty = 1) => {
    set((s) => {
      const existing = s.lines.find(
        (l) => l.productId === product.product_id && l.unitId === product.unit_id
      )
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.productId === product.product_id && l.unitId === product.unit_id
              ? buildLine({ ...l, quantity: l.quantity + qty }, product.selling_price, product.is_vat_exempt)
              : l
          ),
        }
      }
      const newLine: CartLine = {
        productId:   product.product_id,
        productName: product.product_name,
        genericName: product.generic_name,
        unitId:      product.unit_id,
        unitName:    product.default_unit,
        barcode:     product.barcode,
        quantity:    qty,
        isVatExempt: product.is_vat_exempt,
        unitPriceInclusive: product.selling_price,
        ...computeLineTotal(product.selling_price, qty, product.is_vat_exempt),
      }
      return { lines: [...s.lines, newLine] }
    })
  },

  updateQuantity: (productId, unitId, qty) => {
    if (qty <= 0) {
      get().removeLine(productId, unitId)
      return
    }
    set((s) => ({
      lines: s.lines.map((l) => {
        if (l.productId !== productId || l.unitId !== unitId) return l
        return buildLine({ ...l, quantity: qty }, l.unitPriceInclusive, l.isVatExempt)
      }),
    }))
  },

  removeLine: (productId, unitId) =>
    set((s) => ({ lines: s.lines.filter((l) => !(l.productId === productId && l.unitId === unitId)) })),

  setCustomer: (id, name) => set({ customerId: id, customerName: name }),
  clearCart: () => set({ lines: [], customerId: null, customerName: null }),

  subtotalBeforeVat: () => get().lines.reduce((sum, l) => sum + l.lineTotalBeforeVat, 0),
  totalVat: () => get().lines.reduce((sum, l) => sum + l.lineVat, 0),
  grandTotal: () => get().lines.reduce((sum, l) => sum + l.lineTotal, 0),
  itemCount: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
}))

function buildLine(
  l: CartLine,
  unitPriceInclusive: number,
  isVatExempt: boolean
): CartLine {
  const totals = computeLineTotal(unitPriceInclusive, l.quantity, isVatExempt)
  return { ...l, unitPriceInclusive, isVatExempt, ...totals }
}

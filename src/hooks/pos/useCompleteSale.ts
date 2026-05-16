import { useMutation } from '@tanstack/react-query'
import { supabase }    from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any
import { notify }      from '@/store/notificationStore'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import type { CartLine } from '@/store/cartStore'
import type { CompleteSaleResult, PaymentMethod } from '@/types/database.types'

export interface PaymentEntry {
  method: PaymentMethod
  amount: number
  reference_number?: string | null
}

export interface CompleteSalePayload {
  customerId:  string | null
  saleType:    'walk_in' | 'delivery' | 'account'
  payments:    PaymentEntry[]
  notes?:      string | null
}

function buildItems(lines: CartLine[]) {
  return lines.map((l) => ({
    product_id:           l.productId,
    product_unit_id:      l.unitId,
    quantity:             l.quantity,
    unit_name:            l.unitName,
    unit_price_before_vat: l.unitPriceBeforeVat,
    vat_per_unit:         l.vatPerUnit,
    unit_price_inclusive: l.unitPriceInclusive,
    line_total_before_vat: l.lineTotalBeforeVat,
    line_vat:             l.lineVat,
    line_total:           l.lineTotal,
    is_vat_exempt:        l.isVatExempt,
  }))
}

export function useCompleteSale() {
  const clearCart  = useCartStore((s) => s.clearCart)
  const lines      = useCartStore((s) => s.lines)
  const branchId   = useAuthStore((s) => s.profile?.branch_id)
  const tellerId   = useAuthStore((s) => s.user?.id)

  return useMutation<CompleteSaleResult, Error, CompleteSalePayload>({
    mutationFn: async ({ customerId, saleType, payments, notes }) => {
      const payload = {
        branch_id:   branchId,
        teller_id:   tellerId,
        customer_id: customerId,
        sale_type:   saleType,
        items:       buildItems(lines),
        payments:    payments.map((p) => ({
          method:           p.method,
          amount:           p.amount,
          reference_number: p.reference_number ?? null,
        })),
        notes: notes ?? null,
      }

      const { data, error } = await db.rpc('complete_sale', {
        p_data: payload,
      })

      if (error) throw error
      const result = data as CompleteSaleResult
      if (!result.success) throw new Error('Sale could not be completed')
      return result
    },
    onSuccess: () => {
      clearCart()
    },
    onError: (e) => notify.error(e.message),
  })
}

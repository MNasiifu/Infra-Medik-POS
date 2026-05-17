import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '@/services/inventoryService'
import { notify } from '@/store/notificationStore'
import { BATCHES_KEY, ADJUSTMENTS_KEY, INV_STATS_KEY } from './useInventory'
import type { StockBatch, AdjustmentType } from '@/types/database.types'

function invalidateInventory(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [BATCHES_KEY] })
  qc.invalidateQueries({ queryKey: [ADJUSTMENTS_KEY] })
  qc.invalidateQueries({ queryKey: [INV_STATS_KEY] })
}

// ─── Batch Edit ─────────────────────────────────────────────
export function useUpdateStockBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string
      updates: Partial<Pick<StockBatch, 'batch_number' | 'expiry_date' | 'cost_price_per_unit'>>
    }) => inventoryService.updateBatch(id, updates),
    onSuccess: () => {
      invalidateInventory(qc)
      notify.success('Batch updated successfully')
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

// ─── Stock Adjustment ───────────────────────────────────────
export function useApplyStockAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      branch_id:       string
      product_id:      string
      batch_id:        string
      adjustment_type: AdjustmentType
      quantity:        number
      reason:          string
    }) => inventoryService.applyAdjustment(payload),
    onSuccess: (result) => {
      invalidateInventory(qc)
      notify.success(`Adjustment applied. New batch quantity: ${result.new_quantity}`)
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

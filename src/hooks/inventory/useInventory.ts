import { useQuery } from '@tanstack/react-query'
import { inventoryService, type BatchFilters, type AdjustmentFilters } from '@/services/inventoryService'
import { useAuthStore } from '@/store/authStore'

export const BATCHES_KEY     = 'stock-batches'
export const ADJUSTMENTS_KEY = 'stock-adjustments'
export const INV_STATS_KEY   = 'inventory-stats'

export function useStockBatches(filters: BatchFilters = {}) {
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)
  return useQuery({
    queryKey:  [BATCHES_KEY, branchId, filters],
    queryFn:   () => inventoryService.getBatches(branchId, filters),
    staleTime: 1000 * 60 * 2,
  })
}

export function useStockBatch(id: string | undefined) {
  return useQuery({
    queryKey:  [BATCHES_KEY, id],
    queryFn:   () => inventoryService.getBatchById(id!),
    enabled:   !!id,
    staleTime: 1000 * 60 * 2,
  })
}

export function useProductBatches(productId: string | undefined) {
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)
  return useQuery({
    queryKey:  [BATCHES_KEY, 'by-product', productId, branchId],
    queryFn:   () => inventoryService.getBatchesByProduct(productId!, branchId),
    enabled:   !!productId,
    staleTime: 1000 * 30,
  })
}

export function useStockAdjustments(filters: AdjustmentFilters = {}) {
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)
  return useQuery({
    queryKey:  [ADJUSTMENTS_KEY, branchId, filters],
    queryFn:   () => inventoryService.getAdjustments(branchId, filters),
    staleTime: 1000 * 60,
  })
}

export function useInventoryStats() {
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)
  return useQuery({
    queryKey:  [INV_STATS_KEY, branchId],
    queryFn:   () => inventoryService.getStats(branchId),
    staleTime: 1000 * 60 * 2,
  })
}

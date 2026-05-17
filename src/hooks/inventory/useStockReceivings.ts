import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockReceivingService, type CompleteReceivingPayload } from '@/services/stockReceivingService'
import { useAuthStore } from '@/store/authStore'
import { notify }      from '@/store/notificationStore'
import { BATCHES_KEY, INV_STATS_KEY } from './useInventory'
import { PO_KEY } from './usePurchaseOrders'

export const RECEIVINGS_KEY = 'stock-receivings'

export function useStockReceivings() {
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)
  return useQuery({
    queryKey:  [RECEIVINGS_KEY, branchId],
    queryFn:   () => stockReceivingService.getAll(branchId),
    staleTime: 1000 * 60,
  })
}

export function useStockReceiving(id: string | undefined) {
  return useQuery({
    queryKey:  [RECEIVINGS_KEY, id],
    queryFn:   () => stockReceivingService.getById(id!),
    enabled:   !!id,
    staleTime: 1000 * 30,
  })
}

export function useCompleteStockReceiving() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CompleteReceivingPayload) =>
      stockReceivingService.complete(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RECEIVINGS_KEY] })
      qc.invalidateQueries({ queryKey: [BATCHES_KEY] })
      qc.invalidateQueries({ queryKey: [INV_STATS_KEY] })
      qc.invalidateQueries({ queryKey: [PO_KEY] })
      notify.success('Stock received successfully — batches created')
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { purchaseOrderService, type CreatePOPayload } from '@/services/purchaseOrderService'
import { useAuthStore } from '@/store/authStore'
import { notify }      from '@/store/notificationStore'
import { INV_STATS_KEY } from './useInventory'
import type { POStatus } from '@/types/database.types'

export const PO_KEY = 'purchase-orders'

export function usePurchaseOrders() {
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)
  return useQuery({
    queryKey:  [PO_KEY, branchId],
    queryFn:   () => purchaseOrderService.getAll(branchId),
    staleTime: 1000 * 60,
  })
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey:  [PO_KEY, id],
    queryFn:   () => purchaseOrderService.getById(id!),
    enabled:   !!id,
    staleTime: 1000 * 30,
  })
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePOPayload) => purchaseOrderService.create(payload),
    onSuccess: (po) => {
      qc.invalidateQueries({ queryKey: [PO_KEY] })
      qc.invalidateQueries({ queryKey: [INV_STATS_KEY] })
      notify.success(`Purchase Order ${po.po_number} created`)
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

export function useUpdatePOStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: POStatus }) =>
      purchaseOrderService.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PO_KEY] })
      qc.invalidateQueries({ queryKey: [INV_STATS_KEY] })
      notify.success('Purchase order status updated')
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

export function useDeletePO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => purchaseOrderService.deleteDraft(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PO_KEY] })
      notify.success('Draft PO deleted')
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supplierService } from '@/services/supplierService'
import { notify } from '@/store/notificationStore'
import { SUPPLIERS_KEY } from './useSuppliers'
import type { Supplier } from '@/types/database.types'

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
  qc.invalidateQueries({ queryKey: ['suppliers'] })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (
      data: Omit<Supplier, 'id' | 'is_active' | 'created_at' | 'updated_at'>,
    ) => supplierService.create(data),
    onSuccess: (s) => {
      invalidate(qc)
      notify.success(`Supplier "${s.name}" created`)
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>
    }) => supplierService.update(id, data),
    onSuccess: (s) => {
      invalidate(qc)
      notify.success(`Supplier "${s.name}" updated`)
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

export function useDeactivateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => supplierService.deactivate(id),
    onSuccess: () => {
      invalidate(qc)
      notify.success('Supplier deactivated')
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

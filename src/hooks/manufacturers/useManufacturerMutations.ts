import { useMutation, useQueryClient } from '@tanstack/react-query'
import { manufacturerService } from '@/services/manufacturerService'
import { notify } from '@/store/notificationStore'
import { MANUFACTURERS_KEY } from './useManufacturers'

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [MANUFACTURERS_KEY] })
  qc.invalidateQueries({ queryKey: ['manufacturers'] })
}

export function useCreateManufacturer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      country_id?: string | null
      website?: string | null
    }) => manufacturerService.create(data),
    onSuccess: (m) => {
      invalidate(qc)
      notify.success(`Manufacturer "${m.name}" created`)
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

export function useUpdateManufacturer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: {
        name: string
        country_id?: string | null
        website?: string | null
      }
    }) => manufacturerService.update(id, data),
    onSuccess: (m) => {
      invalidate(qc)
      notify.success(`Manufacturer "${m.name}" updated`)
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

export function useDeactivateManufacturer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => manufacturerService.deactivate(id),
    onSuccess: () => {
      invalidate(qc)
      notify.success('Manufacturer deactivated')
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

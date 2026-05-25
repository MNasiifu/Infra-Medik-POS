import { useQuery } from '@tanstack/react-query'
import {
  manufacturerService,
  type ManufacturerFilters,
} from '@/services/manufacturerService'

export const MANUFACTURERS_KEY = 'manufacturers'

export function useManufacturersList(filters: ManufacturerFilters = {}) {
  return useQuery({
    queryKey: [MANUFACTURERS_KEY, 'list', filters],
    queryFn: () => manufacturerService.getAll(filters),
    staleTime: 2 * 60 * 1000,
  })
}

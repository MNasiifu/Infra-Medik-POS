import { useQuery } from '@tanstack/react-query'
import { supplierService, type SupplierFilters } from '@/services/supplierService'

export const SUPPLIERS_KEY = 'suppliers'

export function useSuppliersList(filters: SupplierFilters = {}) {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, 'list', filters],
    queryFn: () => supplierService.getAll(filters),
    staleTime: 2 * 60 * 1000,
  })
}

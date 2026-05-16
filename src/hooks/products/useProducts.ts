import { useQuery } from '@tanstack/react-query'
import { productService, type ProductFilters } from '@/services/productService'

export const PRODUCTS_KEY = 'products'

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, filters],
    queryFn:  () => productService.getAll(filters),
    staleTime: 1000 * 60 * 2,
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, id],
    queryFn:  () => productService.getById(id!),
    enabled:  !!id,
    staleTime: 1000 * 60 * 2,
  })
}

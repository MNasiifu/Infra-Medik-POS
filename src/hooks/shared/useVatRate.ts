import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/productService'

export function useVatRate() {
  const { data = 18 } = useQuery({
    queryKey:  ['vat-rate'],
    queryFn:   productService.getCurrentVatRate,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
  return data
}

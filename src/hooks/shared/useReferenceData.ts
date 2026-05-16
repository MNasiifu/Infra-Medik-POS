import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productService } from '@/services/productService'
import { notify } from '@/store/notificationStore'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn:  productService.getCategories,
    staleTime: 1000 * 60 * 10,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      productService.createCategory(name, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      notify.success('Category created')
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

export function useManufacturers() {
  return useQuery({
    queryKey: ['manufacturers'],
    queryFn:  productService.getManufacturers,
    staleTime: 1000 * 60 * 10,
  })
}

export function useCreateManufacturer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, countryId }: { name: string; countryId?: string }) =>
      productService.createManufacturer(name, countryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturers'] })
      notify.success('Manufacturer created')
    },
    onError: (e: Error) => notify.error(e.message),
  })
}

export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn:  productService.getCountries,
    staleTime: 1000 * 60 * 60, // 1 hour — rarely changes
  })
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn:  productService.getSuppliers,
    staleTime: 1000 * 60 * 5,
  })
}

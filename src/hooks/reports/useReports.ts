import { useQuery } from '@tanstack/react-query'
import {
  reportService,
  type SalesReportFilters,
  type StockValuationFilters,
  type ExpiryReportFilters,
  type VatReportFilters,
} from '@/services/reportService'

// All report queries use enabled:false — triggered explicitly by the page via refetch()

export function useSalesReport(filters: SalesReportFilters, enabled: boolean) {
  return useQuery({
    queryKey:  ['report-sales', filters],
    queryFn:   () => reportService.getSalesReport(filters),
    enabled,
    staleTime: 0,
  })
}

export function useStockValuation(filters: StockValuationFilters, enabled: boolean) {
  return useQuery({
    queryKey:  ['report-stock', filters],
    queryFn:   () => reportService.getStockValuation(filters),
    enabled,
    staleTime: 0,
  })
}

export function useExpiryReport(filters: ExpiryReportFilters, enabled: boolean) {
  return useQuery({
    queryKey:  ['report-expiry', filters],
    queryFn:   () => reportService.getExpiryReport(filters),
    enabled,
    staleTime: 0,
  })
}

export function useVatReport(filters: VatReportFilters, enabled: boolean) {
  return useQuery({
    queryKey:  ['report-vat', filters],
    queryFn:   () => reportService.getVatReport(filters),
    enabled,
    staleTime: 0,
  })
}

export function useTellers() {
  return useQuery({
    queryKey:  ['tellers'],
    queryFn:   reportService.getTellers,
    staleTime: 5 * 60_000,
  })
}

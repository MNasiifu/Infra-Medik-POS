import { useMutation } from '@tanstack/react-query'
import { efrisService, type EfrisSubmitResult } from '@/services/efrisService'

export function useSubmitEfrisInvoice() {
  return useMutation<EfrisSubmitResult, Error, string>({
    mutationFn: (saleId: string) => efrisService.submitInvoice(saleId),
    // Errors are handled by the caller — a failed EFRIS submission
    // must NOT block the POS; the sale is already recorded.
  })
}

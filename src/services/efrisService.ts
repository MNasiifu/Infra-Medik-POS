import { supabase } from '@/lib/supabase'

export interface EfrisSubmitResult {
  success:            boolean
  verification_code:  string | null
  qr_data:            string | null
  error:              string | null
}

export const efrisService = {
  async submitInvoice(saleId: string): Promise<EfrisSubmitResult> {
    const { data, error } = await supabase.functions.invoke('efris-submit', {
      body: { sale_id: saleId },
    })
    if (error) throw new Error(error.message)
    return data as EfrisSubmitResult
  },
}

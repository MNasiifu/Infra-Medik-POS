import { DashboardTemplate } from '@/components/templates/DashboardTemplate/DashboardTemplate'
import { StockBatchTable }   from '@/components/organisms/StockBatchTable/StockBatchTable'

export function StockBatchesPage() {
  return (
    <DashboardTemplate>
      <StockBatchTable />
    </DashboardTemplate>
  )
}

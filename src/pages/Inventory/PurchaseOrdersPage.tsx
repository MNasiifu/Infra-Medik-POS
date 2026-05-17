import { DashboardTemplate }   from '@/components/templates/DashboardTemplate/DashboardTemplate'
import { PurchaseOrderTable }  from '@/components/organisms/PurchaseOrderTable/PurchaseOrderTable'

export function PurchaseOrdersPage() {
  return (
    <DashboardTemplate>
      <PurchaseOrderTable />
    </DashboardTemplate>
  )
}

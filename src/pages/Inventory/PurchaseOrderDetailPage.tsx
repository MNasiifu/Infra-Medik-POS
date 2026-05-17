import { DashboardTemplate }    from '@/components/templates/DashboardTemplate/DashboardTemplate'
import { PurchaseOrderDetail }  from '@/components/organisms/PurchaseOrderDetail/PurchaseOrderDetail'

export function PurchaseOrderDetailPage() {
  return (
    <DashboardTemplate>
      <PurchaseOrderDetail />
    </DashboardTemplate>
  )
}

import { DashboardTemplate } from '@/components/templates/DashboardTemplate/DashboardTemplate'
import { SupplierTable } from '@/components/organisms/SupplierTable/SupplierTable'

export function SuppliersPage() {
  return (
    <DashboardTemplate>
      <SupplierTable />
    </DashboardTemplate>
  )
}

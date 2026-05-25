import { DashboardTemplate } from '@/components/templates/DashboardTemplate/DashboardTemplate'
import { ManufacturerTable } from '@/components/organisms/ManufacturerTable/ManufacturerTable'

export function ManufacturersPage() {
  return (
    <DashboardTemplate>
      <ManufacturerTable />
    </DashboardTemplate>
  )
}

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, CircularProgress, IconButton,
  Stack, Tooltip, Typography,
} from '@mui/material'
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import ArrowBackIcon  from '@mui/icons-material/ArrowBack'
import RefreshIcon    from '@mui/icons-material/Refresh'
import TableChartIcon from '@mui/icons-material/TableChart'
import PrintIcon      from '@mui/icons-material/Print'

import { DashboardTemplate }   from '@/components/templates/DashboardTemplate/DashboardTemplate'
import { useStockValuation }   from '@/hooks/reports/useReports'
import { useAuthStore }        from '@/store/authStore'
import { downloadExcel }       from '@/lib/reports/exportExcel'
import { printReport }         from '@/lib/reports/exportPdf'
import { formatUGX, formatDate } from '@/lib/formatters'
import { getDaysUntilExpiry }  from '@/lib/formatters'
import type { StockValuationRow } from '@/services/reportService'

export function StockReportPage() {
  const navigate  = useNavigate()
  const branchId  = useAuthStore((s) => s.profile?.branch_id ?? null)

  const { data: rows = [], isLoading, isError, refetch } = useStockValuation({ branchId }, true)

  const totalValue = rows.reduce((s, r) => s + r.batch_value, 0)
  const totalUnits = rows.reduce((s, r) => s + r.quantity_remaining, 0)

  const columns: GridColDef<StockValuationRow>[] = useMemo(() => [
    {
      field: 'product_name', headerName: 'Product', flex: 1, minWidth: 180,
      renderCell: ({ row }: GridRenderCellParams<StockValuationRow>) => (
        <Box py={0.5}>
          <Typography variant="body2" fontWeight={600}>{row.product_name}</Typography>
          {row.generic_name && <Typography variant="caption" color="text.secondary">{row.generic_name}</Typography>}
        </Box>
      ),
    },
    { field: 'category_name', headerName: 'Category', width: 130,
      renderCell: ({ value }: GridRenderCellParams) =>
        <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'}>{value ?? '—'}</Typography> },
    { field: 'unit_name', headerName: 'Unit', width: 90 },
    { field: 'batch_number', headerName: 'Batch', width: 120,
      renderCell: ({ value }: GridRenderCellParams) =>
        <Typography variant="body2" fontFamily="monospace" color={value ? 'text.primary' : 'text.disabled'}>{value ?? '—'}</Typography> },
    {
      field: 'expiry_date', headerName: 'Expiry', width: 130,
      renderCell: ({ value }: GridRenderCellParams) => {
        const days = getDaysUntilExpiry(value as string | null)
        const color = days === null ? 'text.disabled' : days < 0 ? 'error.main' : days <= 30 ? 'warning.main' : days <= 90 ? 'warning.dark' : 'text.primary'
        return <Typography variant="body2" color={color}>{formatDate(value as string | null)}</Typography>
      },
    },
    { field: 'quantity_remaining', headerName: 'Qty', width: 80, align: 'right', headerAlign: 'right',
      renderCell: ({ value }: GridRenderCellParams) => <Typography variant="body2" fontWeight={600}>{value as number}</Typography> },
    { field: 'unit_cost', headerName: 'Unit cost', width: 120, align: 'right', headerAlign: 'right',
      renderCell: ({ value }: GridRenderCellParams) => <Typography variant="body2" fontFamily="monospace">{formatUGX(value as number)}</Typography> },
    { field: 'batch_value', headerName: 'Batch value', width: 130, align: 'right', headerAlign: 'right',
      renderCell: ({ value }: GridRenderCellParams) =>
        <Typography variant="body2" fontWeight={700} fontFamily="monospace">{formatUGX(value as number)}</Typography> },
  ], [])

  const handleExportExcel = async () => {
    await downloadExcel(
      'Stock Valuation',
      [
        { header: 'Product',      key: 'product_name',       width: 28 },
        { header: 'Generic name', key: 'generic_name',       width: 24 },
        { header: 'Category',     key: 'category_name',      width: 18 },
        { header: 'Unit',         key: 'unit_name',          width: 12 },
        { header: 'Batch #',      key: 'batch_number',       width: 16 },
        { header: 'Expiry date',  key: 'expiry_date',        width: 14 },
        { header: 'Qty',          key: 'quantity_remaining', width: 8  },
        { header: 'Unit cost',    key: 'unit_cost',          width: 14, numFmt: '#,##0' },
        { header: 'Batch value',  key: 'batch_value',        width: 16, numFmt: '#,##0' },
      ],
      rows.map((r) => ({ ...r, expiry_date: formatDate(r.expiry_date) })) as Record<string, unknown>[],
      `INFRA_MEDIK_Stock_Valuation_${new Date().toISOString().slice(0, 10)}.xlsx`,
      { 'Generated': new Date().toLocaleString('en-UG'), 'Total value': formatUGX(totalValue) },
    )
  }

  const handlePrint = () => {
    printReport({
      title: 'Stock Valuation Report',
      meta:  { 'As at': new Date().toLocaleString('en-UG') },
      summary: [
        { label: 'Total inventory value', value: formatUGX(totalValue) },
        { label: 'Total units',           value: String(totalUnits) },
        { label: 'Batch lines',           value: String(rows.length) },
      ],
      columns: [
        { header: 'Product',      key: 'product_name' },
        { header: 'Generic',      key: 'generic_name' },
        { header: 'Category',     key: 'category_name' },
        { header: 'Unit',         key: 'unit_name' },
        { header: 'Batch',        key: 'batch_number' },
        { header: 'Expiry',       key: 'expiry_date',          render: (v) => formatDate(v as string | null) },
        { header: 'Qty',          key: 'quantity_remaining',   align: 'right' },
        { header: 'Unit cost',    key: 'unit_cost',            align: 'right', render: (v) => formatUGX(v as number) },
        { header: 'Batch value',  key: 'batch_value',          align: 'right', render: (v) => formatUGX(v as number) },
      ],
      rows: rows as unknown as Record<string, unknown>[],
    })
  }

  return (
    <DashboardTemplate>
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <Tooltip title="Back to reports" arrow>
          <IconButton size="small" onClick={() => navigate('/reports')}><ArrowBackIcon /></IconButton>
        </Tooltip>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>Stock Valuation</Typography>
          <Typography variant="body2" color="text.secondary">Current inventory value by product and batch.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh" arrow>
            <IconButton size="small" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <CircularProgress size={18} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          <Button size="small" variant="outlined" startIcon={<TableChartIcon />} onClick={handleExportExcel} disabled={rows.length === 0}>Excel</Button>
          <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} disabled={rows.length === 0}>PDF</Button>
        </Stack>
      </Box>

      {rows.length > 0 && (
        <Stack direction="row" spacing={3} mb={2} px={0.5}>
          <Box><Typography variant="caption" color="text.secondary">Total inventory value</Typography>
            <Typography variant="subtitle1" fontWeight={700} fontFamily="monospace">{formatUGX(totalValue)}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Total units</Typography>
            <Typography variant="subtitle1" fontWeight={700}>{totalUnits.toLocaleString()}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Batch lines</Typography>
            <Typography variant="subtitle1" fontWeight={700}>{rows.length}</Typography></Box>
        </Stack>
      )}

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load report. Make sure get_stock_valuation RPC is deployed.</Alert>}

      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => `${r.product_name}-${r.batch_number ?? 'x'}`}
        loading={isLoading}
        autoHeight
        density="compact"
        disableRowSelectionOnClick
        pageSizeOptions={[50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
      />
    </DashboardTemplate>
  )
}

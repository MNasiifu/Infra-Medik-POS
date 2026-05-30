import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, IconButton,
  InputLabel, MenuItem, Paper, Select, Stack, Tooltip, Typography,
} from '@mui/material'
import { type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import { AppDataGrid } from '@/components/molecules/AppDataGrid'
import ArrowBackIcon  from '@mui/icons-material/ArrowBack'
import PlayArrowIcon  from '@mui/icons-material/PlayArrow'
import TableChartIcon from '@mui/icons-material/TableChart'
import PrintIcon      from '@mui/icons-material/Print'

import { DashboardTemplate } from '@/components/templates/DashboardTemplate/DashboardTemplate'
import { useExpiryReport }   from '@/hooks/reports/useReports'
import { useAuthStore }      from '@/store/authStore'
import { downloadExcel }     from '@/lib/reports/exportExcel'
import { printReport }       from '@/lib/reports/exportPdf'
import { formatDate }        from '@/lib/formatters'
import type { ExpiryReportRow, ExpiryReportFilters } from '@/services/reportService'

const DAYS_OPTIONS = [
  { label: '30 days',  value: 30  },
  { label: '60 days',  value: 60  },
  { label: '90 days',  value: 90  },
  { label: '180 days', value: 180 },
  { label: '365 days', value: 365 },
]

function urgencyChip(days: number): { label: string; color: 'error' | 'warning' | 'default' | 'success' } {
  if (days < 0)   return { label: 'Expired',   color: 'error' }
  if (days <= 30)  return { label: '≤ 30 days', color: 'error' }
  if (days <= 60)  return { label: '≤ 60 days', color: 'warning' }
  if (days <= 90)  return { label: '≤ 90 days', color: 'default' }
  return               { label: `${days} days`, color: 'success' }
}

export function ExpiryReportPage() {
  const navigate = useNavigate()
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)

  const [filters, setFilters] = useState<ExpiryReportFilters>({ daysAhead: 90, branchId })
  const [enabled, setEnabled] = useState(false)

  const { data: rows = [], isLoading, isError, refetch } = useExpiryReport(filters, enabled)

  const handleRun = () => {
    if (enabled) refetch()
    else         setEnabled(true)
  }

  const expiredCount  = rows.filter((r) => r.days_until_expiry < 0).length
  const within30      = rows.filter((r) => r.days_until_expiry >= 0 && r.days_until_expiry <= 30).length

  const columns: GridColDef<ExpiryReportRow>[] = useMemo(() => [
    {
      field: 'product_name', headerName: 'Product', flex: 1, width: 150,
      renderCell: ({ row }: GridRenderCellParams<ExpiryReportRow>) => (
        <Box py={0.5}>
          <Typography variant="body2" fontWeight={600}>{row.product_name}</Typography>
        </Box>
      ),
    },
    { field: 'batch_number', headerName: 'Batch #', width: 130,
      renderCell: ({ value }: GridRenderCellParams) =>
        <Typography variant="body2" fontFamily="monospace" color={value ? 'text.primary' : 'text.disabled'}>{value ?? '—'}</Typography> },
    { field: 'expiry_date', headerName: 'Expiry date', width: 130,
      renderCell: ({ value, row }: GridRenderCellParams<ExpiryReportRow>) => (
        <Typography variant="body2" color={row.days_until_expiry <= 30 ? 'error.main' : row.days_until_expiry <= 90 ? 'warning.main' : 'text.primary'}>
          {formatDate(value as string)}
        </Typography>
      ),
    },
    {
      field: 'days_until_expiry', headerName: 'Days left', width: 130,
      renderCell: ({ value }: GridRenderCellParams) => {
        const days = value as number
        const cfg  = urgencyChip(days)
        return (
          <Chip label={cfg.label} size="small" color={cfg.color} variant="filled"
            sx={{ borderRadius: '6px', fontSize: '0.7rem' }} />
        )
      },
    },
    { field: 'quantity_remaining', headerName: 'Qty remaining', width: 130, align: 'right', headerAlign: 'right',
      renderCell: ({ value }: GridRenderCellParams) =>
        <Typography variant="body2" fontWeight={600}>{value as number}</Typography> },
    { field: 'unit_name', headerName: 'Unit', width: 100 },
  ], [])

  const handleExportExcel = async () => {
    await downloadExcel(
      'Expiry Report',
      [
        { header: 'Product',      key: 'product_name',       width: 28 },
        { header: 'Generic',      key: 'generic_name',       width: 22 },
        { header: 'Batch #',      key: 'batch_number',       width: 16 },
        { header: 'Expiry date',  key: 'expiry_date',        width: 14 },
        { header: 'Days left',    key: 'days_until_expiry',  width: 12 },
        { header: 'Qty',          key: 'quantity_remaining', width: 8  },
        { header: 'Unit',         key: 'unit_name',          width: 12 },
        { header: 'Branch',       key: 'branch_name',        width: 20 },
      ],
      rows.map((r) => ({ ...r, expiry_date: formatDate(r.expiry_date) })) as Record<string, unknown>[],
      `INFRA_MEDIK_Expiry_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      { 'Window': `Next ${filters.daysAhead} days`, 'Generated': new Date().toLocaleString('en-UG') },
    )
  }

  const handlePrint = () => {
    printReport({
      title: 'Expiry Report',
      meta:  { 'Window': `Next ${filters.daysAhead} days`, 'Generated': new Date().toLocaleString('en-UG') },
      summary: [
        { label: 'Total lines',   value: String(rows.length) },
        { label: 'Expired',       value: String(expiredCount) },
        { label: 'Expiring ≤30d', value: String(within30) },
      ],
      columns: [
        { header: 'Product',    key: 'product_name' },
        { header: 'Generic',    key: 'generic_name' },
        { header: 'Batch',      key: 'batch_number' },
        { header: 'Expiry',     key: 'expiry_date',          render: (v) => formatDate(v as string) },
        { header: 'Days left',  key: 'days_until_expiry',    render: (v) => {
            const d = v as number
            if (d < 0)   return '<span class="badge badge-red">Expired</span>'
            if (d <= 30) return `<span class="badge badge-orange">${d}d</span>`
            if (d <= 90) return `<span class="badge badge-yellow">${d}d</span>`
            return String(d)
          }
        },
        { header: 'Qty',        key: 'quantity_remaining',   align: 'right' },
        { header: 'Unit',       key: 'unit_name' },
        { header: 'Branch',     key: 'branch_name' },
      ],
      rows: rows as unknown as Record<string, unknown>[],
    })
  }

  return (
    <DashboardTemplate>
      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={{ xs: 1.5, sm: 1.5 }}
        mb={3}
      >
        {/* Mobile: Arrow Back Icon + Title in one row; Desktop: Icon only */}
        <Box display="flex" alignItems="center" gap={1} width={{ xs: '100%', sm: 'auto' }}>
          <Tooltip title="Back to reports" arrow>
            <IconButton size="small" onClick={() => navigate('/reports')} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}><ArrowBackIcon /></IconButton>
          </Tooltip>
          <Typography variant="h5" fontWeight={700} sx={{ display: { xs: 'block', sm: 'none' } }}>
            Expiry Report
          </Typography>
        </Box>

        {/* Desktop: Title + Subtitle; Mobile: Subtitle only */}
        <Box flex={{ sm: 1 }} width={{ xs: '100%', sm: 'auto' }}>
          <Typography variant="h5" fontWeight={700} sx={{ display: { xs: 'none', sm: 'block' } }}>
            Expiry Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Batches expiring within a chosen window.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} width={{ xs: '100%', sm: 'auto' }}>
          <Button size="small" variant="outlined" startIcon={<TableChartIcon />} onClick={handleExportExcel} disabled={rows.length === 0} sx={{ width: { xs: '100%', sm: 'auto' } }}>Excel</Button>
          <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} disabled={rows.length === 0} sx={{ width: { xs: '100%', sm: 'auto' } }}>PDF</Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-end">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Show expiring within</InputLabel>
            <Select value={filters.daysAhead} label="Show expiring within"
              onChange={(e) => setFilters((f) => ({ ...f, daysAhead: Number(e.target.value) }))}>
              {DAYS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" size="small"
            startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRun} disabled={isLoading}>
            Run report
          </Button>
        </Stack>
      </Paper>

      {rows.length > 0 && (
        <Stack direction="row" spacing={3} mb={2} px={0.5}>
          <Box><Typography variant="caption" color="text.secondary">Total lines</Typography>
            <Typography variant="subtitle1" fontWeight={700}>{rows.length}</Typography></Box>
          {expiredCount > 0 && (
            <Box><Typography variant="caption" color="text.secondary">Already expired</Typography>
              <Typography variant="subtitle1" fontWeight={700} color="error.main">{expiredCount}</Typography></Box>
          )}
          {within30 > 0 && (
            <Box><Typography variant="caption" color="text.secondary">Expiring within 30 days</Typography>
              <Typography variant="subtitle1" fontWeight={700} color="warning.main">{within30}</Typography></Box>
          )}
        </Stack>
      )}

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load report. Make sure get_expiry_report RPC is deployed.</Alert>}

      {!enabled && !isLoading && (
        <Box py={6} textAlign="center">
          <Typography variant="body2" color="text.secondary">Select a window and click <strong>Run report</strong>.</Typography>
        </Box>
      )}

      {enabled && (
        <AppDataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => `${r.product_name}-${r.batch_number ?? 'x'}`}
          loading={isLoading}
          density="compact"
          pageSizeOptions={[50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 50 } },
            sorting:    { sortModel: [{ field: 'days_until_expiry', sort: 'asc' }] },
          }}
        />
      )}
    </DashboardTemplate>
  )
}

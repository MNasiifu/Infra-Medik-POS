import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, CircularProgress, Divider, IconButton, Paper,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import ArrowBackIcon  from '@mui/icons-material/ArrowBack'
import PlayArrowIcon  from '@mui/icons-material/PlayArrow'
import TableChartIcon from '@mui/icons-material/TableChart'
import PrintIcon      from '@mui/icons-material/Print'

import { DashboardTemplate } from '@/components/templates/DashboardTemplate/DashboardTemplate'
import { StatCard }          from '@/components/molecules/StatCard/StatCard'
import { useVatReport }      from '@/hooks/reports/useReports'
import { useAuthStore }      from '@/store/authStore'
import { downloadExcel }     from '@/lib/reports/exportExcel'
import { printReport }       from '@/lib/reports/exportPdf'
import { formatUGX, formatDate, formatDateInput } from '@/lib/formatters'
import type { VatReportFilters } from '@/services/reportService'

function monthStart() {
  const d = new Date()
  return formatDateInput(new Date(d.getFullYear(), d.getMonth(), 1).toISOString())
}

export function VatReportPage() {
  const navigate = useNavigate()
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)

  const [filters, setFilters] = useState<VatReportFilters>({
    dateFrom: monthStart(),
    dateTo:   formatDateInput(new Date().toISOString()),
    branchId,
  })
  const [enabled, setEnabled] = useState(false)

  const { data, isLoading, isError, refetch } = useVatReport(filters, enabled)

  const handleRun = () => {
    if (enabled) refetch()
    else         setEnabled(true)
  }

  const chartDataset = useMemo(() =>
    (data?.by_day ?? []).map((d) => ({
      date:    formatDate(d.date),
      vat:     d.vat_amount,
      revenue: d.total_sales,
    }))
  , [data])

  const handleExportExcel = async () => {
    if (!data) return
    await downloadExcel(
      'VAT Report',
      [
        { header: 'Date',          key: 'date',              width: 14 },
        { header: 'Transactions',  key: 'transaction_count', width: 16 },
        { header: 'Total sales',   key: 'total_sales',       width: 16, numFmt: '#,##0' },
        { header: 'VAT (18%)',     key: 'vat_amount',        width: 14, numFmt: '#,##0' },
      ],
      data.by_day.map((d) => ({ ...d, date: formatDate(d.date) })) as Record<string, unknown>[],
      `INFRA_MEDIK_VAT_${filters.dateFrom}_to_${filters.dateTo}.xlsx`,
      {
        'Period':              `${filters.dateFrom} to ${filters.dateTo}`,
        'Total VAT collected': formatUGX(data.total_vat),
        'VAT rate':            `${data.vat_rate}%`,
        'TIN':                 '10756690689',
        'Generated':           new Date().toLocaleString('en-UG'),
      },
    )
  }

  const handlePrint = () => {
    if (!data) return
    printReport({
      title: 'VAT Report',
      meta:  { Period: `${filters.dateFrom} to ${filters.dateTo}`, TIN: '10756690689', 'VAT rate': `${data.vat_rate}%` },
      summary: [
        { label: 'Total revenue',    value: formatUGX(data.total_sales) },
        { label: 'Revenue excl. VAT', value: formatUGX(data.total_before_vat) },
        { label: 'Total VAT',        value: formatUGX(data.total_vat) },
        { label: 'VAT-exempt sales', value: formatUGX(data.vat_exempt_total) },
        { label: 'Transactions',     value: String(data.transaction_count) },
      ],
      columns: [
        { header: 'Date',         key: 'date',              render: (v) => formatDate(v as string) },
        { header: 'Transactions', key: 'transaction_count', align: 'right' },
        { header: 'Total sales',  key: 'total_sales',       align: 'right', render: (v) => formatUGX(v as number) },
        { header: 'VAT (18%)',    key: 'vat_amount',        align: 'right', render: (v) => formatUGX(v as number) },
      ],
      rows: data.by_day as unknown as Record<string, unknown>[],
    })
  }

  return (
    <DashboardTemplate>
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <Tooltip title="Back to reports" arrow>
          <IconButton size="small" onClick={() => navigate('/reports')}><ArrowBackIcon /></IconButton>
        </Tooltip>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>VAT Report</Typography>
          <Typography variant="body2" color="text.secondary">
            Total VAT collected with daily breakdown
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<TableChartIcon />} onClick={handleExportExcel} disabled={!data}>Excel</Button>
          <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!data}>PDF</Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-end">
          <Box
            component="input" type="date"
            value={filters.dateFrom}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
          />
          <Typography variant="body2" color="text.secondary">to</Typography>
          <Box
            component="input" type="date"
            value={filters.dateTo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
          />
          <Button variant="contained" size="small"
            startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRun} disabled={isLoading}>
            Run report
          </Button>
        </Stack>
      </Paper>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load report. Make sure get_vat_report RPC is deployed.</Alert>}

      {!enabled && !isLoading && (
        <Box py={6} textAlign="center">
          <Typography variant="body2" color="text.secondary">Set a date range and click <strong>Run report</strong>.</Typography>
        </Box>
      )}

      {enabled && data && (
        <>
          {/* KPI summary */}
          <Box
            display="grid"
            gridTemplateColumns={{ xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }}
            gap={2}
            mb={3}
          >
            <StatCard title="Total Revenue"      value={formatUGX(data.total_sales)}       loading={isLoading} />
            <StatCard title="Revenue excl. VAT"  value={formatUGX(data.total_before_vat)}  loading={isLoading} />
            <StatCard title="VAT Collected (18%)" value={formatUGX(data.total_vat)}        loading={isLoading} />
            <StatCard title="VAT-exempt Sales"   value={formatUGX(data.vat_exempt_total)}  loading={isLoading} />
          </Box>

          {/* Daily chart */}
          {chartDataset.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1.5}>VAT collected per day</Typography>
              <BarChart
                dataset={chartDataset}
                series={[
                  { dataKey: 'vat',     label: 'VAT (UGX)',     color: '#1976d2' },
                  { dataKey: 'revenue', label: 'Revenue (UGX)', color: '#43a047', stack: undefined },
                ]}
                xAxis={[{ scaleType: 'band', dataKey: 'date' }]}
                yAxis={[{ valueFormatter: (v: number) => `${(v / 1000).toFixed(0)}K` }]}
                height={240}
                margin={{ left: 60, bottom: 60, right: 20, top: 10 }}
              />
            </Paper>
          )}

          {/* Daily breakdown table */}
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <Box px={2} pt={2} pb={1}>
              <Typography variant="subtitle2" fontWeight={700}>Daily breakdown</Typography>
            </Box>
            <Divider />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Transactions</TableCell>
                  <TableCell align="right">Total sales</TableCell>
                  <TableCell align="right">VAT (18%)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.by_day.map((day) => (
                  <TableRow key={day.date} hover>
                    <TableCell><Typography variant="body2">{formatDate(day.date)}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{day.transaction_count}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" fontFamily="monospace">{formatUGX(day.total_sales)}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" fontFamily="monospace" fontWeight={600}>{formatUGX(day.vat_amount)}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Divider />
            <Box px={2} py={1.5} display="flex" justifyContent="flex-end" gap={4}>
              <Typography variant="subtitle2" fontWeight={700}>
                Total: {formatUGX(data.total_sales)}
              </Typography>
              <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                VAT: {formatUGX(data.total_vat)}
              </Typography>
            </Box>
          </Paper>
        </>
      )}
    </DashboardTemplate>
  )
}

import { Box, Grid, Typography, Paper, Chip, Skeleton, Alert, Stack, Divider } from '@mui/material'
import AttachMoneyIcon     from '@mui/icons-material/AttachMoney'
import ReceiptLongIcon     from '@mui/icons-material/ReceiptLong'
import PercentIcon         from '@mui/icons-material/Percent'
import WarningAmberIcon    from '@mui/icons-material/WarningAmber'
import ErrorOutlineIcon    from '@mui/icons-material/ErrorOutline'
import HourglassTopIcon    from '@mui/icons-material/HourglassTop'
import { BarChart }        from '@mui/x-charts/BarChart'
import { PieChart }        from '@mui/x-charts/PieChart'

import { useNavigate } from 'react-router-dom'
import { DashboardTemplate } from '@/components/templates/DashboardTemplate/DashboardTemplate'
import { StatCard }          from '@/components/molecules/StatCard/StatCard'
import { useDashboardKPIs, useTellerSummary } from '@/hooks/dashboard/useDashboard'
import { usePermissions }    from '@/hooks/auth/usePermissions'
import { useAuth }           from '@/hooks/auth/useAuth'
import { formatUGX, formatDate, formatPaymentMethod } from '@/lib/formatters'
import type { PaymentMethod } from '@/types/database.types'

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  cash:          '#4caf50',
  mtn_momo:      '#ffb300',
  airtel_money:  '#f44336',
}

export function DashboardPage() {
  const { hasFullDashboard, hasTellerDashboard } = usePermissions()
  const { fullName } = useAuth()
  const today = formatDate(new Date().toISOString())

  return (
    <DashboardTemplate>
      {/* Greeting */}
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>
          Welcome back, {fullName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {today} ·{' '}
          {hasTellerDashboard && !hasFullDashboard
            ? 'Your sales summary for today.'
            : "Here's what's happening at INFRA MEDIK today."}
        </Typography>
      </Box>

      {hasFullDashboard ? <ManagerDashboard /> : <TellerDashboardToday />}
    </DashboardTemplate>
  )
}

// ─── Admin / Manager full dashboard ──────────────────────────────────────────

function ManagerDashboard() {
  const navigate = useNavigate()
  const { data: kpis, isLoading, isError } = useDashboardKPIs()

  if (isError) {
    return <Alert severity="error">Failed to load dashboard data. Make sure the get_dashboard_kpis RPC is deployed.</Alert>
  }

  return (
    <>
      {/* Row 1: Revenue KPIs */}
      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Today's Revenue"
            value={isLoading ? '—' : formatUGX(kpis!.today_revenue)}
            icon={<AttachMoneyIcon />}
            iconBg="success.50"
            iconColor="success.main"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Transactions"
            value={isLoading ? '—' : kpis!.today_transactions}
            subtitle="sales today"
            icon={<ReceiptLongIcon />}
            iconBg="primary.50"
            iconColor="primary.main"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="VAT Collected"
            value={isLoading ? '—' : formatUGX(kpis!.today_vat)}
            subtitle="18% VAT inclusive"
            icon={<PercentIcon />}
            iconBg="info.50"
            iconColor="info.main"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Row 2: Inventory alerts */}
      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Low Stock Items"
            value={isLoading ? '—' : kpis!.low_stock_count}
            subtitle="1–9 units remaining"
            icon={<WarningAmberIcon />}
            iconBg="warning.50"
            iconColor="warning.main"
            loading={isLoading}
            onClick={() => navigate('/inventory/product-stock')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Out of Stock"
            value={isLoading ? '—' : kpis!.out_of_stock_count}
            subtitle="zero units remaining"
            icon={<ErrorOutlineIcon />}
            iconBg="error.50"
            iconColor="error.main"
            loading={isLoading}
            onClick={() => navigate('/inventory/product-stock')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Expiring ≤ 30 days"
            value={isLoading ? '—' : kpis!.expiring_soon_count}
            subtitle="items with stock remaining"
            icon={<HourglassTopIcon />}
            iconBg="warning.50"
            iconColor="warning.dark"
            loading={isLoading}
            onClick={() => navigate('/reports/expiry')}
          />
        </Grid>
      </Grid>

      {/* Row 3: Charts */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <TopProductsChart
            products={kpis?.top_products_today ?? null}
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} md={5}>
          <PaymentBreakdownChart
            breakdown={kpis?.payment_breakdown_today ?? null}
            loading={isLoading}
          />
        </Grid>
      </Grid>
    </>
  )
}

// ─── Teller limited dashboard (shown on /dashboard for teller role) ───────────

function TellerDashboardToday() {
  const { data: summary, isLoading, isError } = useTellerSummary()

  if (isError) {
    return <Alert severity="error">Failed to load your summary. Make sure the get_teller_summary RPC is deployed.</Alert>
  }

  return (
    <>
      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="My Transactions"
            value={isLoading ? '—' : summary!.transaction_count}
            subtitle="today"
            icon={<ReceiptLongIcon />}
            iconBg="primary.50"
            iconColor="primary.main"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="My Total Sales"
            value={isLoading ? '—' : formatUGX(summary!.total_sales)}
            icon={<AttachMoneyIcon />}
            iconBg="success.50"
            iconColor="success.main"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="VAT Collected"
            value={isLoading ? '—' : formatUGX(summary!.total_vat)}
            icon={<PercentIcon />}
            iconBg="info.50"
            iconColor="info.main"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Voided Sales"
            value={isLoading ? '—' : summary!.voided_count}
            subtitle="today"
            icon={<WarningAmberIcon />}
            iconBg="warning.50"
            iconColor="warning.main"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Payment method breakdown */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} mb={2}>
          Payment methods — today
        </Typography>
        {isLoading ? (
          <Stack spacing={1}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height={28} />)}
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {(['cash', 'mtn_momo', 'airtel_money'] as PaymentMethod[]).map((method) => {
              const amount = method === 'cash'
                ? summary!.cash_total
                : method === 'mtn_momo'
                  ? summary!.mtn_momo_total
                  : summary!.airtel_money_total
              return (
                <Box key={method} display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: 10, height: 10, borderRadius: '50%',
                        bgcolor: PAYMENT_COLORS[method],
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2">{formatPaymentMethod(method)}</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                    {formatUGX(amount)}
                  </Typography>
                </Box>
              )
            })}
            <Divider />
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" fontWeight={700}>Total</Typography>
              <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                {formatUGX(summary!.total_sales)}
              </Typography>
            </Box>
          </Stack>
        )}
      </Paper>
    </>
  )
}

// ─── Chart sub-components ─────────────────────────────────────────────────────

interface TopProductsChartProps {
  products: Array<{ name: string; qty_sold: number; revenue: number }> | null
  loading:  boolean
}

function TopProductsChart({ products, loading }: TopProductsChartProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
      <Typography variant="subtitle2" fontWeight={700} mb={2}>
        Top products today
      </Typography>

      {loading && <Skeleton variant="rectangular" height={200} />}

      {!loading && (!products || products.length === 0) && (
        <Box py={4} textAlign="center">
          <Typography variant="body2" color="text.secondary">No sales recorded today yet.</Typography>
        </Box>
      )}

      {!loading && products && products.length > 0 && (
        <BarChart
          dataset={products.map((p) => ({
            name:    p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
            revenue: p.revenue,
            qty:     p.qty_sold,
          }))}
          series={[{ dataKey: 'revenue', label: 'Revenue (UGX)', color: '#1976d2' }]}
          xAxis={[{ scaleType: 'band', dataKey: 'name' }]}
          yAxis={[{ valueFormatter: (v: number) => `${(v / 1000).toFixed(0)}K` }]}
          height={230}
          margin={{ left: 60, bottom: 60, right: 10, top: 10 }}
          slotProps={{ legend: { hidden: true } }}
          tooltip={{ trigger: 'item' }}
        />
      )}
    </Paper>
  )
}

interface PaymentBreakdownChartProps {
  breakdown: Array<{ payment_method: PaymentMethod; total: number }> | null
  loading:   boolean
}

function PaymentBreakdownChart({ breakdown, loading }: PaymentBreakdownChartProps) {
  const pieData = (breakdown ?? []).map((b, i) => ({
    id:    i,
    value: b.total,
    label: formatPaymentMethod(b.payment_method),
    color: PAYMENT_COLORS[b.payment_method] ?? '#9e9e9e',
  }))

  const grandTotal = pieData.reduce((s, d) => s + d.value, 0)

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
      <Typography variant="subtitle2" fontWeight={700} mb={2}>
        Payment breakdown today
      </Typography>

      {loading && <Skeleton variant="circular" width={180} height={180} sx={{ mx: 'auto' }} />}

      {!loading && (!breakdown || breakdown.length === 0) && (
        <Box py={4} textAlign="center">
          <Typography variant="body2" color="text.secondary">No payments today yet.</Typography>
        </Box>
      )}

      {!loading && breakdown && breakdown.length > 0 && (
        <>
          <Box display="flex" justifyContent="center">
            <PieChart
              series={[{
                data:        pieData,
                innerRadius: 40,
                outerRadius: 90,
                paddingAngle: 3,
                cornerRadius: 4,
              }]}
              height={200}
              slotProps={{ legend: { hidden: true } }}
              tooltip={{ trigger: 'item' }}
            />
          </Box>

          {/* Legend */}
          <Stack spacing={1} mt={1.5}>
            {pieData.map((d) => (
              <Box key={d.id} display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    size="small"
                    sx={{
                      width: 12, height: 12, borderRadius: '2px',
                      bgcolor: d.color, border: 'none', p: 0,
                      '& .MuiChip-label': { display: 'none' },
                    }}
                  />
                  <Typography variant="caption">{d.label}</Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" fontFamily="monospace" fontWeight={600}>
                    {formatUGX(d.value)}
                  </Typography>
                  {grandTotal > 0 && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {((d.value / grandTotal) * 100).toFixed(0)}%
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </>
      )}
    </Paper>
  )
}

import { useNavigate } from 'react-router-dom'
import { Box, Button, Grid, Typography, Stack } from '@mui/material'
import LayersIcon          from '@mui/icons-material/Layers'
import AccountBalanceIcon  from '@mui/icons-material/AccountBalance'
import WarningAmberIcon    from '@mui/icons-material/WarningAmber'
import EventBusyIcon       from '@mui/icons-material/EventBusy'
import ErrorOutlineIcon    from '@mui/icons-material/ErrorOutline'
import RemoveShoppingCartIcon from '@mui/icons-material/RemoveShoppingCart'
import ReceiptLongIcon     from '@mui/icons-material/ReceiptLong'
import TuneIcon            from '@mui/icons-material/Tune'
import LocalShippingIcon   from '@mui/icons-material/LocalShipping'
import AddIcon             from '@mui/icons-material/Add'
import FactCheckIcon       from '@mui/icons-material/FactCheck'

import { StatCard }          from '@/components/molecules/StatCard/StatCard'
import { useInventoryStats } from '@/hooks/inventory/useInventory'
import { formatUGX }         from '@/lib/formatters'

export function InventoryOverview() {
  const navigate = useNavigate()
  const { data: stats, isLoading } = useInventoryStats()

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>Inventory</Typography>
          <Typography variant="body2" color="text.secondary">
            Stock overview, batches, adjustments, and purchase orders.
          </Typography>
        </Box>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            title="Active Batches"
            value={stats?.totalBatches ?? 0}
            icon={<LayersIcon />}
            iconColor="primary.main"
            iconBg="primary.50"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            title="Stock Value"
            value={formatUGX(stats?.totalStockValue ?? 0)}
            icon={<AccountBalanceIcon />}
            iconColor="success.main"
            iconBg="success.50"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            title="Low Stock"
            value={stats?.lowStockCount ?? 0}
            subtitle="products ≤ 10 units"
            icon={<WarningAmberIcon />}
            iconColor="warning.main"
            iconBg="warning.50"
            loading={isLoading}
            onClick={() => navigate('/inventory/product-stock')}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            title="Expiring Soon"
            value={stats?.expiringCount ?? 0}
            subtitle="within 30 days"
            icon={<EventBusyIcon />}
            iconColor="warning.main"
            iconBg="warning.50"
            loading={isLoading}
            onClick={() => navigate('/reports/expiry')}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            title="Expired"
            value={stats?.expiredCount ?? 0}
            subtitle="batches past expiry"
            icon={<ErrorOutlineIcon />}
            iconColor="error.main"
            iconBg="error.50"
            loading={isLoading}
            onClick={() => navigate('/reports/expiry')}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            title="Out of Stock"
            value={stats?.outOfStockCount ?? 0}
            subtitle="active products"
            icon={<RemoveShoppingCartIcon />}
            iconColor="error.main"
            iconBg="error.50"
            loading={isLoading}
            onClick={() => navigate('/inventory/product-stock')}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            title="Pending POs"
            value={stats?.pendingPOCount ?? 0}
            icon={<ReceiptLongIcon />}
            iconColor="info.main"
            iconBg="info.50"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <StatCard
            title="Recent Adjustments"
            value={stats?.recentAdjustmentCount ?? 0}
            subtitle="last 7 days"
            icon={<TuneIcon />}
            iconColor="secondary.main"
            iconBg="secondary.50"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Quick actions */}
      <Typography variant="subtitle1" fontWeight={600} mb={1.5}>
        Quick Actions
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap">
        <Button
          variant="contained"
          startIcon={<LayersIcon />}
          onClick={() => navigate('/inventory/batches')}
        >
          View Batches
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<TuneIcon />}
          onClick={() => navigate('/inventory/adjustments')}
        >
          Adjustments
        </Button>
        <Button
          variant="outlined"
          startIcon={<FactCheckIcon />}
          onClick={() => navigate('/inventory/stock-takes')}
        >
          Stock Takes
        </Button>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => navigate('/inventory/purchase-orders')}
        >
          Purchase Orders
        </Button>
        <Button
          variant="outlined"
          startIcon={<LocalShippingIcon />}
          onClick={() => navigate('/inventory/receive')}
        >
          Receive Stock
        </Button>
      </Stack>
    </Box>
  )
}

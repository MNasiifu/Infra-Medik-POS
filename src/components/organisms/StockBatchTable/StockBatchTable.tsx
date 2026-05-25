import { useState, useMemo, useCallback } from 'react'
import {
  Box, Chip, IconButton, Tooltip, MenuItem,
  Stack, Button, Typography,
  Select, FormControl, InputLabel, Switch, FormControlLabel,
} from '@mui/material'
import { type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import { AppDataGrid } from '@/components/molecules/AppDataGrid'
import { SearchTextField } from '@/components/molecules/SearchTextField'
import EditIcon        from '@mui/icons-material/Edit'
import FilterListIcon  from '@mui/icons-material/FilterList'

import { StockBatchEditDialog } from '@/components/organisms/StockBatchEditDialog/StockBatchEditDialog'
import { useStockBatches }      from '@/hooks/inventory/useInventory'
import { useSuppliers }         from '@/hooks/shared/useReferenceData'
import { formatUGX, formatDate, getDaysUntilExpiry } from '@/lib/formatters'
import type { StockBatchWithDetails } from '@/services/inventoryService'

function ExpiryChip({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) {
    return <Typography variant="caption" color="text.disabled">No expiry</Typography>
  }

  const days = getDaysUntilExpiry(expiryDate)!
  let color: 'error' | 'warning' | 'success' | 'default' = 'success'
  let label = formatDate(expiryDate)

  if (days < 0) {
    color = 'error'
    label = `Expired (${formatDate(expiryDate)})`
  } else if (days <= 30) {
    color = 'warning'
    label = `${formatDate(expiryDate)} (${days}d)`
  }

  return (
    <Chip
      label={label}
      size="small"
      color={color}
      variant={days < 0 ? 'filled' : 'outlined'}
      sx={{ borderRadius: '6px', fontSize: '0.7rem' }}
    />
  )
}

type ExpiryFilter = 'all' | 'expiring_soon' | 'expired' | 'valid'

export function StockBatchTable() {
  const [search, setSearch]               = useState('')
  const [expiryStatus, setExpiryStatus]   = useState<ExpiryFilter>('all')
  const [supplierId, setSupplierId]       = useState('')
  const [showDepleted, setShowDepleted]   = useState(false)
  const [showFilters, setShowFilters]     = useState(false)
  const [editBatch, setEditBatch]         = useState<StockBatchWithDetails | null>(null)

  const { data: batches = [], isLoading } = useStockBatches({
    search:       search || undefined,
    expiryStatus: expiryStatus !== 'all' ? expiryStatus : undefined,
    supplierId:   supplierId || undefined,
    showDepleted: showDepleted || undefined,
  })
  const { data: suppliers = [] } = useSuppliers()

  const handleEdit = useCallback(
    (batch: StockBatchWithDetails) => setEditBatch(batch), [],
  )

  const columns: GridColDef<StockBatchWithDetails>[] = useMemo(() => [
    {
      field: 'product', headerName: 'Product', flex: 1.5, minWidth: 200,
      valueGetter: (_: unknown, row: StockBatchWithDetails) => row.products?.name ?? '—',
      renderCell: ({ row }: GridRenderCellParams<StockBatchWithDetails>) => (
        <Box py={0.5}>
          <Typography variant="body2" fontWeight={600} lineHeight={1.3}>
            {row.products?.name ?? '—'}
          </Typography>
          {row.products?.generic_name && (
            <Typography variant="caption" color="text.secondary" lineHeight={1.2} display="block">
              {row.products.generic_name}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'batch_number', headerName: 'Batch #', width: 130,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
          {value as string}
        </Typography>
      ),
    },
    {
      field: 'unit', headerName: 'Unit', width: 100,
      valueGetter: (_: unknown, row: StockBatchWithDetails) => row.product_units?.unit_name ?? '—',
    },
    {
      field: 'expiry_date', headerName: 'Expiry', width: 170,
      renderCell: ({ row }: GridRenderCellParams<StockBatchWithDetails>) => (
        <ExpiryChip expiryDate={row.expiry_date} />
      ),
    },
    {
      field: 'quantity_remaining', headerName: 'Qty Remaining', width: 130,
      align: 'right', headerAlign: 'right',
      renderCell: ({ row }: GridRenderCellParams<StockBatchWithDetails>) => {
        const pct = row.quantity_received > 0
          ? (row.quantity_remaining / row.quantity_received) * 100
          : 0
        const color = pct <= 10 ? 'error.main' : pct <= 25 ? 'warning.main' : 'text.primary'
        return (
          <Tooltip title={`Received: ${row.quantity_received}`} arrow>
            <Typography variant="body2" fontWeight={600} fontFamily="monospace" color={color}>
              {row.quantity_remaining}
            </Typography>
          </Tooltip>
        )
      },
    },
    {
      field: 'cost_price_per_unit', headerName: 'Cost/Unit', width: 120,
      align: 'right', headerAlign: 'right',
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="monospace">
          {formatUGX(value as number)}
        </Typography>
      ),
    },
    {
      field: 'supplier', headerName: 'Supplier', width: 140,
      valueGetter: (_: unknown, row: StockBatchWithDetails) => row.suppliers?.name ?? '—',
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" color={value === '—' ? 'text.disabled' : 'text.primary'}>
          {value as string}
        </Typography>
      ),
    },
    {
      field: 'actions', headerName: '', width: 56, sortable: false, filterable: false,
      align: 'center',
      renderCell: ({ row }: GridRenderCellParams<StockBatchWithDetails>) => (
        <Tooltip title="Edit batch" arrow>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleEdit(row) }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [handleEdit])

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>Stock Batches</Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage all stock batches (FEFO tracked).
        </Typography>
      </Box>

      {/* Toolbar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2} alignItems="flex-start">
        <SearchTextField
          placeholder="Search by product, batch number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, maxWidth: { sm: 380 } }}
        />
        <Button
          variant={showFilters ? 'contained' : 'outlined'}
          size="small"
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters((v) => !v)}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Filters
        </Button>
      </Stack>

      {/* Filter panel */}
      {showFilters && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Expiry Status</InputLabel>
            <Select
              value={expiryStatus}
              onChange={(e) => setExpiryStatus(e.target.value as ExpiryFilter)}
              label="Expiry Status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
              <MenuItem value="expiring_soon">Expiring ≤ 30 days</MenuItem>
              <MenuItem value="valid">Valid</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Supplier</InputLabel>
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              label="Supplier"
            >
              <MenuItem value="">All suppliers</MenuItem>
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={showDepleted}
                onChange={(e) => setShowDepleted(e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="body2">Show depleted</Typography>}
          />
        </Stack>
      )}

      {/* Data grid */}
      <AppDataGrid
        rows={batches}
        columns={columns}
        loading={isLoading}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
          sorting:    { sortModel: [{ field: 'expiry_date', sort: 'asc' }] },
        }}
        sx={{
          '& .MuiDataGrid-row:nth-of-type(odd)': {
            borderBottom: '1px solid', borderColor: 'divider',
          },
        }}
      />

      {/* Edit dialog */}
      <StockBatchEditDialog
        open={!!editBatch}
        batch={editBatch}
        onClose={() => setEditBatch(null)}
      />
    </Box>
  )
}

import { useState, useMemo } from 'react'
import {
  Box, Chip, MenuItem, Typography,
  Button, FormControl,
  InputLabel, Select,
} from '@mui/material'
import { type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import { AppDataGrid } from '@/components/molecules/AppDataGrid'
import AddIcon    from '@mui/icons-material/Add'

import { StockAdjustmentForm }   from '@/components/organisms/StockAdjustmentForm/StockAdjustmentForm'
import { SearchTextField }       from '@/components/molecules/SearchTextField'
import { ResponsiveStack, responsiveWidth } from '@/components/molecules/ResponsiveStack'
import { useStockAdjustments }   from '@/hooks/inventory/useInventory'
import { formatDate } from '@/lib/formatters'
import { ADJUSTMENT_LABELS }     from '@/lib/zod-schemas/inventory.schemas'
import type { StockAdjustmentWithDetails } from '@/services/inventoryService'
import type { AdjustmentType }   from '@/types/database.types'

const TYPE_COLORS: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  damage:             'error',
  expiry:             'error',
  theft:              'error',
  correction:         'info',
  return_to_supplier: 'warning',
  other:              'default',
}

export function StockAdjustmentTable() {
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('')
  const [formOpen, setFormOpen]           = useState(false)

  const { data: adjustments = [], isLoading } = useStockAdjustments({
    search:         search || undefined,
    adjustmentType: (typeFilter || undefined) as AdjustmentType | undefined,
  })

  const columns: GridColDef<StockAdjustmentWithDetails>[] = useMemo(() => [
    {
      field: 'created_at', headerName: 'Date', width: 150,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2">{formatDate(value as string)}</Typography>
      ),
    },
    {
      field: 'product', headerName: 'Product', flex: 1, minWidth: 180,
      valueGetter: (_: unknown, row: StockAdjustmentWithDetails) => row.products?.name ?? '—',
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600}>{value as string}</Typography>
      ),
    },
    {
      field: 'batch', headerName: 'Batch', width: 130,
      valueGetter: (_: unknown, row: StockAdjustmentWithDetails) =>
        row.stock_batches?.batch_number ?? '—',
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="monospace">{value as string}</Typography>
      ),
    },
    {
      field: 'adjustment_type', headerName: 'Type', width: 150,
      renderCell: ({ value }: GridRenderCellParams) => {
        const type = value as string
        return (
          <Chip
            label={ADJUSTMENT_LABELS[type] ?? type}
            size="small"
            color={TYPE_COLORS[type] ?? 'default'}
            variant="outlined"
            sx={{ borderRadius: '6px', fontSize: '0.7rem' }}
          />
        )
      },
    },
    {
      field: 'quantity', headerName: 'Qty', width: 100,
      align: 'right', headerAlign: 'right',
      renderCell: ({ value }: GridRenderCellParams) => {
        const qty = value as number
        const color = qty < 0 ? 'error.main' : 'success.main'
        return (
          <Typography variant="body2" fontWeight={700} fontFamily="monospace" color={color}>
            {qty > 0 ? '+' : ''}{qty}
          </Typography>
        )
      },
    },
    {
      field: 'reason', headerName: 'Reason', flex: 1, minWidth: 160,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" noWrap title={value as string}>
          {value as string}
        </Typography>
      ),
    },
    {
      field: 'adjusted_by_profile', headerName: 'Adjusted By', width: 150,
      valueGetter: (_: unknown, row: StockAdjustmentWithDetails) =>
        row.adjusted_by_profile?.full_name ?? '—',
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">{value as string}</Typography>
      ),
    },
  ], [])

  const typeOptions = Object.entries(ADJUSTMENT_LABELS).map(([value, label]) => (
    { value, label }
  ))

  return (
    <Box>
      {/* Header */}
      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={{ xs: 1.5, sm: 0 }}
        mb={3}
      >
        <Box flex={{ sm: 1 }} width={{ xs: '100%', sm: 'auto' }}>
          <Typography variant="h5" fontWeight={700}>Stock Adjustments</Typography>
          <Typography variant="body2" color="text.secondary">
            History of all stock quantity adjustments.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setFormOpen(true)}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          New Adjustment
        </Button>
      </Box>

      {/* Toolbar */}
      <ResponsiveStack spacing={1.5} mb={2}>
        <SearchTextField
          placeholder="Search by product, batch, reason…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ ...responsiveWidth(), flex: 1, maxWidth: { sm: 380 } }}
        />
        <FormControl size="small" sx={responsiveWidth(160)}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            label="Type"
          >
            <MenuItem value="">All types</MenuItem>
            {typeOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </ResponsiveStack>

      {/* Data grid */}
      <AppDataGrid
        rows={adjustments}
        columns={columns}
        loading={isLoading}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
          sorting:    { sortModel: [{ field: 'created_at', sort: 'desc' }] },
        }}
      />

      {/* New adjustment dialog */}
      <StockAdjustmentForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Box>
  )
}

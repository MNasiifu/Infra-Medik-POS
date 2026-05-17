import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Chip, IconButton, Tooltip, Typography, Stack,
} from '@mui/material'
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import AddIcon        from '@mui/icons-material/Add'
import VisibilityIcon from '@mui/icons-material/Visibility'
import DeleteIcon     from '@mui/icons-material/Delete'

import { PurchaseOrderForm } from '@/components/organisms/PurchaseOrderForm/PurchaseOrderForm'
import { usePurchaseOrders, useDeletePO } from '@/hooks/inventory/usePurchaseOrders'
import { formatDate, formatUGX } from '@/lib/formatters'
import type { PurchaseOrderWithDetails } from '@/services/purchaseOrderService'
import type { POStatus } from '@/types/database.types'

const STATUS_CONFIG: Record<POStatus, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  draft:              { label: 'Draft',              color: 'default' },
  sent:               { label: 'Sent',              color: 'info'    },
  partially_received: { label: 'Partial',           color: 'warning' },
  received:           { label: 'Received',          color: 'success' },
  cancelled:          { label: 'Cancelled',         color: 'error'   },
}

export function PurchaseOrderTable() {
  const navigate = useNavigate()
  const { data: orders = [], isLoading } = usePurchaseOrders()
  const deleteMutation = useDeletePO()
  const [formOpen, setFormOpen] = useState(false)

  const columns: GridColDef<PurchaseOrderWithDetails>[] = useMemo(() => [
    {
      field: 'po_number', headerName: 'PO #', width: 140,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600} fontFamily="monospace">
          {value as string}
        </Typography>
      ),
    },
    {
      field: 'order_date', headerName: 'Date', width: 140,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2">{formatDate(value as string)}</Typography>
      ),
    },
    {
      field: 'supplier', headerName: 'Supplier', flex: 1, minWidth: 160,
      valueGetter: (_: unknown, row: PurchaseOrderWithDetails) => row.suppliers?.name ?? '—',
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={500}>{value as string}</Typography>
      ),
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: ({ value }: GridRenderCellParams) => {
        const cfg = STATUS_CONFIG[value as POStatus]
        return (
          <Chip
            label={cfg.label}
            size="small"
            color={cfg.color}
            variant="filled"
            sx={{ borderRadius: '6px', fontSize: '0.7rem' }}
          />
        )
      },
    },
    {
      field: 'subtotal', headerName: 'Total', width: 140,
      align: 'right', headerAlign: 'right',
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="monospace">
          {formatUGX(value as number)}
        </Typography>
      ),
    },
    {
      field: 'expected_delivery_date', headerName: 'Expected', width: 140,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'}>
          {value ? formatDate(value as string) : '—'}
        </Typography>
      ),
    },
    {
      field: 'actions', headerName: '', width: 90, sortable: false,
      renderCell: ({ row }: GridRenderCellParams<PurchaseOrderWithDetails>) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="View details" arrow>
            <IconButton size="small"
              onClick={(e) => { e.stopPropagation(); navigate(`/inventory/purchase-orders/${row.id}`) }}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {row.status === 'draft' && (
            <Tooltip title="Delete" arrow>
              <IconButton size="small" color="error"
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(row.id) }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ], [navigate, deleteMutation])

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>Purchase Orders</Typography>
          <Typography variant="body2" color="text.secondary">
            Create and track purchase orders to suppliers.
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
          New PO
        </Button>
      </Box>

      <DataGrid
        rows={orders}
        columns={columns}
        loading={isLoading}
        autoHeight
        density="comfortable"
        disableRowSelectionOnClick
        onRowClick={({ row }) => navigate(`/inventory/purchase-orders/${row.id}`)}
        pageSizeOptions={[25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
          sorting:    { sortModel: [{ field: 'order_date', sort: 'desc' }] },
        }}
        sx={{
          border: '1px solid', borderColor: 'divider', borderRadius: 2,
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          backgroundColor: 'background.paper',
        }}
      />

      <PurchaseOrderForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Box>
  )
}

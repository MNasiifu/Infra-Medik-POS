import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Button, Chip, Typography, Stack, Paper,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, IconButton, Tooltip,
  Autocomplete, Alert,
} from '@mui/material'
import DeleteIcon    from '@mui/icons-material/Delete'
import CheckIcon     from '@mui/icons-material/Check'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import {
  useStockTake, useAddStockTakeItem,
  useUpdateStockTakeItemCount, useRemoveStockTakeItem,
  useCompleteStockTake,
} from '@/hooks/inventory/useStockTakes'
import { useStockBatches } from '@/hooks/inventory/useInventory'
import { DeleteConfirmationModal } from '@/components/molecules/DeleteConfirmationModal/DeleteConfirmationModal'
import { formatDate }      from '@/lib/formatters'
import { ResponsiveStack, responsiveWidth } from '@/components/molecules/ResponsiveStack'
import type { StockTakeItemWithDetails } from '@/services/stockTakeService'
import type { StockTakeStatus }          from '@/types/database.types'

const STATUS_COLORS: Record<StockTakeStatus, 'default' | 'info' | 'success' | 'error'> = {
  draft: 'default', in_progress: 'info', completed: 'success', cancelled: 'error',
}

export function StockTakeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: stockTake, isLoading } = useStockTake(id)
  const { data: allBatches = [] }      = useStockBatches()
  const addItem      = useAddStockTakeItem()
  const updateCount  = useUpdateStockTakeItemCount()
  const removeItem   = useRemoveStockTakeItem()
  const complete     = useCompleteStockTake()

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<StockTakeItemWithDetails | null>(null)

  if (isLoading || !stockTake) {
    return <Typography color="text.secondary">Loading…</Typography>
  }

  const isEditable = stockTake.status === 'draft' || stockTake.status === 'in_progress'
  const items = stockTake.stock_take_items ?? []

  const handleAddItem = () => {
    if (!selectedBatchId || !id) return
    const batch = allBatches.find((b) => b.id === selectedBatchId)
    if (!batch) return
    addItem.mutate({
      stock_take_id:   id,
      product_id:      batch.product_id,
      batch_id:        batch.id,
      system_quantity: batch.quantity_remaining,
    }, { onSuccess: () => setSelectedBatchId(null) })
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      removeItem.mutate(deleteConfirm.id, {
        onSuccess: () => setDeleteConfirm(null),
      })
    }
  }

  const handleComplete = () => {
    if (!id) return
    const hasUncounted = items.some((i) => i.counted_quantity === null)
    if (hasUncounted) return
    complete.mutate(id, {
      onSuccess: () => navigate('/inventory/stock-takes'),
    })
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => navigate('/inventory/stock-takes')}>
          <ArrowBackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            Stock Take
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Started {formatDate(stockTake.started_at)} by {stockTake.started_by_profile?.full_name}
          </Typography>
        </Box>
        <Chip
          label={stockTake.status.replace('_', ' ')}
          color={STATUS_COLORS[stockTake.status]}
          sx={{ textTransform: 'capitalize', fontWeight: 600 }}
        />
      </Stack>

      {stockTake.notes && (
        <Typography variant="body2" color="text.secondary" mb={2}>
          Notes: {stockTake.notes}
        </Typography>
      )}

      {/* Add item panel */}
      {isEditable && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle2" mb={1.5}>Add batch to count</Typography>
          <ResponsiveStack spacing={1.5}>
            <Autocomplete
              options={allBatches}
              getOptionLabel={(b) =>
                `${b.products?.name ?? 'Unknown'} — ${b.batch_number} (Qty: ${b.quantity_remaining})`
              }
              value={allBatches.find((b) => b.id === selectedBatchId) ?? null}
              onChange={(_, b) => setSelectedBatchId(b?.id ?? null)}
              renderInput={(params) => (
                <TextField {...params} label="Search batch" size="small" />
              )}
              sx={{ ...responsiveWidth(300), flex: 1 }}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              noOptionsText="No batches available"
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleAddItem}
              disabled={!selectedBatchId || addItem.isPending}
              sx={responsiveWidth()}
            >
              Add
            </Button>
          </ResponsiveStack>
        </Paper>
      )}

      {/* Items table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Batch</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>System Qty</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Counted Qty</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Variance</TableCell>
              {isEditable && <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.disabled" py={3}>
                    No items yet. Add batches above to begin counting.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <StockTakeItemRow
                key={item.id}
                item={item}
                editable={isEditable}
                onUpdate={(qty, notes) => updateCount.mutate({ itemId: item.id, countedQuantity: qty, notes })}
                onRemove={() => setDeleteConfirm(item)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Complete button */}
      {isEditable && items.length > 0 && (
        <Box mt={3}>
          {items.some((i) => i.counted_quantity === null) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Enter counted quantities for all items before completing.
            </Alert>
          )}
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
            onClick={handleComplete}
            disabled={
              complete.isPending ||
              items.some((i) => i.counted_quantity === null)
            }
          >
            {complete.isPending ? 'Completing…' : 'Complete Stock Take'}
          </Button>
        </Box>
      )}

      {/* Delete confirmation modal */}
      <DeleteConfirmationModal
        open={!!deleteConfirm}
        title="Remove item from stock take?"
        itemName={deleteConfirm ? deleteConfirm.products?.name ?? 'Item' : ''}
        description="You are about to remove"
        warningMessage="This will discard the count for this batch. This action cannot be undone."
        isPending={removeItem.isPending}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        confirmButtonText="Remove"
      />
    </Box>
  )
}

// ─── Item row sub-component ─────────────────────────────────
function StockTakeItemRow({ item, editable, onUpdate, onRemove }: {
  item:     StockTakeItemWithDetails
  editable: boolean
  onUpdate: (qty: number, notes?: string) => void
  onRemove: () => void
}) {
  const [counted, setCounted] = useState<string>(
    item.counted_quantity !== null ? String(item.counted_quantity) : '',
  )

  const handleBlur = () => {
    const val = parseFloat(counted)
    if (!isNaN(val) && val !== item.counted_quantity) {
      onUpdate(val)
    }
  }

  const variance = item.variance ?? null
  const varianceColor = variance === null
    ? 'text.disabled'
    : variance === 0 ? 'success.main' : 'error.main'

  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          {item.products?.name ?? '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontFamily="monospace">
          {item.stock_batches?.batch_number ?? '—'}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontFamily="monospace">
          {item.system_quantity}
        </Typography>
      </TableCell>
      <TableCell align="right">
        {editable ? (
          <TextField
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            onBlur={handleBlur}
            type="number"
            size="small"
            sx={{ width: 90 }}
            inputProps={{ style: { textAlign: 'right', fontFamily: 'monospace' } }}
          />
        ) : (
          <Typography variant="body2" fontFamily="monospace">
            {item.counted_quantity ?? '—'}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight={700} fontFamily="monospace" color={varianceColor}>
          {variance !== null ? (variance > 0 ? `+${variance}` : variance) : '—'}
        </Typography>
      </TableCell>
      {editable && (
        <TableCell align="center">
          <Tooltip title="Remove" arrow>
            <IconButton size="small" color="error" onClick={onRemove}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      )}
    </TableRow>
  )
}

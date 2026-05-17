import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, IconButton, Stack,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'

import { FormTextField } from '@/components/molecules/FormField/FormField'
import { useUpdateStockBatch } from '@/hooks/inventory/useInventoryMutations'
import {
  stockBatchEditSchema,
  type StockBatchEditFormValues,
} from '@/lib/zod-schemas/inventory.schemas'
import type { StockBatchWithDetails } from '@/services/inventoryService'

interface Props {
  open:    boolean
  batch:   StockBatchWithDetails | null
  onClose: () => void
}

export function StockBatchEditDialog({ open, batch, onClose }: Props) {
  const updateBatch = useUpdateStockBatch()

  const { control, handleSubmit, reset } = useForm<StockBatchEditFormValues>({
    resolver: zodResolver(stockBatchEditSchema),
  })

  useEffect(() => {
    if (batch) {
      reset({
        batch_number:        batch.batch_number,
        expiry_date:         batch.expiry_date ?? null,
        cost_price_per_unit: batch.cost_price_per_unit,
      })
    }
  }, [batch, reset])

  const onSubmit = (values: StockBatchEditFormValues) => {
    if (!batch) return
    updateBatch.mutate(
      {
        id: batch.id,
        updates: {
          batch_number:        values.batch_number,
          expiry_date:         values.expiry_date || null,
          cost_price_per_unit: values.cost_price_per_unit,
        },
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={700} flex={1}>
          Edit Batch
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers>
          {batch && (
            <Typography variant="body2" color="text.secondary" mb={2}>
              {batch.products?.name} — {batch.product_units?.unit_name}
            </Typography>
          )}
          <Stack spacing={2}>
            <FormTextField<StockBatchEditFormValues>
              name="batch_number"
              control={control}
              label="Batch Number"
              size="small"
            />
            <FormTextField<StockBatchEditFormValues>
              name="expiry_date"
              control={control}
              label="Expiry Date"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <FormTextField<StockBatchEditFormValues>
              name="cost_price_per_unit"
              control={control}
              label="Cost Price per Unit (UGX)"
              type="number"
              size="small"
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={updateBatch.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={updateBatch.isPending}
          >
            {updateBatch.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

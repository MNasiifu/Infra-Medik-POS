import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, IconButton, Stack,
  Autocomplete, TextField, Alert,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { FormTextField, FormSelectField } from '@/components/molecules/FormField/FormField'
import { useProducts } from '@/hooks/products/useProducts'
import { useProductBatches } from '@/hooks/inventory/useInventory'
import { useApplyStockAdjustment } from '@/hooks/inventory/useInventoryMutations'
import { useAuthStore } from '@/store/authStore'
import {
  stockAdjustmentSchema,
  type StockAdjustmentFormValues,
  ADJUSTMENT_TYPES,
  ADJUSTMENT_LABELS,
} from '@/lib/zod-schemas/inventory.schemas'
import { formatDate } from '@/lib/formatters'

interface Props {
  open:    boolean
  onClose: () => void
}

const REDUCE_TYPES = ['damage', 'expiry', 'theft', 'return_to_supplier']

export function StockAdjustmentForm({ open, onClose }: Props) {
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)
  const applyAdj = useApplyStockAdjustment()

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { product_id: '', batch_id: '', adjustment_type: undefined, quantity: 0, reason: '' },
  })

  const selectedProductId  = watch('product_id')
  const adjustmentType     = watch('adjustment_type')

  const { data: products = [] }      = useProducts()
  const { data: batches = [] }       = useProductBatches(selectedProductId || undefined)
  const [productSearch, setProductSearch] = useState('')

  // Reset batch when product changes
  useEffect(() => { setValue('batch_id', '') }, [selectedProductId, setValue])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) reset({ product_id: '', batch_id: '', adjustment_type: undefined, quantity: 0, reason: '' })
  }, [open, reset])

  const isReduceType = REDUCE_TYPES.includes(adjustmentType ?? '')

  const onSubmit = (values: StockAdjustmentFormValues) => {
    if (!branchId) return
    const qty = isReduceType ? -Math.abs(values.quantity) : values.quantity
    applyAdj.mutate(
      {
        branch_id:       branchId,
        product_id:      values.product_id,
        batch_id:        values.batch_id,
        adjustment_type: values.adjustment_type,
        quantity:         qty,
        reason:          values.reason,
      },
      { onSuccess: () => onClose() },
    )
  }

  const typeOptions = ADJUSTMENT_TYPES.map((t) => ({ value: t, label: ADJUSTMENT_LABELS[t] }))

  const batchOptions = batches.map((b) => ({
    value: b.id,
    label: `${b.batch_number} — Qty: ${b.quantity_remaining}${b.expiry_date ? ` — Exp: ${formatDate(b.expiry_date)}` : ''}`,
  }))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={700} flex={1}>
          New Stock Adjustment
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {/* Product search */}
            <Controller
              name="product_id"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  options={products}
                  getOptionLabel={(p) => `${p.name}${p.generic_name ? ` (${p.generic_name})` : ''}`}
                  inputValue={productSearch}
                  onInputChange={(_, v) => setProductSearch(v)}
                  value={products.find((p) => p.id === field.value) ?? null}
                  onChange={(_, p) => field.onChange(p?.id ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Product"
                      size="small"
                      error={!!errors.product_id}
                      helperText={errors.product_id?.message}
                    />
                  )}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                  noOptionsText="No products found"
                />
              )}
            />

            {/* Batch select */}
            <FormSelectField<StockAdjustmentFormValues>
              name="batch_id"
              control={control}
              label="Batch"
              options={batchOptions}
              size="small"
              disabled={!selectedProductId || batches.length === 0}
              helperText={
                selectedProductId && batches.length === 0
                  ? 'No batches with remaining stock'
                  : undefined
              }
            />

            {/* Adjustment type */}
            <FormSelectField<StockAdjustmentFormValues>
              name="adjustment_type"
              control={control}
              label="Adjustment Type"
              options={typeOptions}
              size="small"
            />

            {/* Info hint */}
            {adjustmentType && (
              <Alert severity={isReduceType ? 'warning' : 'info'} sx={{ py: 0 }}>
                <Typography variant="caption">
                  {isReduceType
                    ? 'This adjustment will REDUCE stock. Enter the quantity to remove.'
                    : 'Enter positive quantity to add, negative to remove.'}
                </Typography>
              </Alert>
            )}

            {/* Quantity */}
            <FormTextField<StockAdjustmentFormValues>
              name="quantity"
              control={control}
              label={isReduceType ? 'Quantity to Remove' : 'Quantity (+/-)'}
              type="number"
              size="small"
            />

            {/* Reason */}
            <FormTextField<StockAdjustmentFormValues>
              name="reason"
              control={control}
              label="Reason"
              multiline
              rows={2}
              size="small"
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={applyAdj.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color={isReduceType ? 'warning' : 'primary'}
            disabled={applyAdj.isPending}
          >
            {applyAdj.isPending ? 'Applying…' : 'Apply Adjustment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

import { useState, useEffect } from 'react'
import {
  Box, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Tooltip, Typography, Dialog, DialogTitle,
  DialogContent, DialogActions, Stack, InputAdornment, TextField,
  Switch, FormControlLabel, Alert,
} from '@mui/material'
import AddIcon       from '@mui/icons-material/Add'
import EditIcon      from '@mui/icons-material/Edit'
import DeleteIcon    from '@mui/icons-material/Delete'
import StarIcon      from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import CalculateIcon from '@mui/icons-material/Calculate'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver }         from '@hookform/resolvers/zod'

import { productUnitSchema, type ProductUnitFormValues } from '@/lib/zod-schemas/product.schemas'
import {
  useAddProductUnit, useUpdateProductUnit,
  useDeleteProductUnit, useSetDefaultUnit,
} from '@/hooks/products/useProductMutations'
import { useVatRate } from '@/hooks/shared/useVatRate'
import { formatUGX }  from '@/lib/formatters'
import type { ProductUnit } from '@/types/database.types'

interface Props {
  productId:     string
  units:         ProductUnit[]
  isVatExempt:   boolean
}

function UnitDialog({
  open, onClose, existing, productId, isVatExempt, vatRate,
}: {
  open:        boolean
  onClose:     () => void
  existing?:   ProductUnit
  productId:   string
  isVatExempt: boolean
  vatRate:     number
}) {
  const addUnit    = useAddProductUnit()
  const updateUnit = useUpdateProductUnit()

  const { control, handleSubmit, watch, setValue, reset, formState: { isSubmitting, errors } } =
    useForm<ProductUnitFormValues>({
      resolver: zodResolver(productUnitSchema),
      defaultValues: { unit_name: 'Piece', conversion_factor: 1, price_before_vat: 0, vat_amount: 0, cost_price: 0, is_default: false },
    })

  useEffect(() => {
    if (!open) return
    reset(
      existing
        ? {
            unit_name:         existing.unit_name,
            conversion_factor: existing.conversion_factor,
            price_before_vat:  existing.price_before_vat,
            vat_amount:        existing.vat_amount,
            cost_price:        existing.cost_price,
            is_default:        existing.is_default,
          }
        : { unit_name: 'Piece', conversion_factor: 1, price_before_vat: 0, vat_amount: 0, cost_price: 0, is_default: false },
    )
  }, [open, existing, reset])

  const priceBeforeVat = watch('price_before_vat')
  const vatAmount      = isVatExempt ? 0 : Math.round(priceBeforeVat * (vatRate / 100))
  const sellingPrice   = priceBeforeVat + vatAmount

  const onSubmit = async (values: ProductUnitFormValues) => {
    const payload = { ...values, vat_amount: vatAmount }
    if (existing) {
      await updateUnit.mutateAsync({ unitId: existing.id, data: payload })
    } else {
      await addUnit.mutateAsync({ productId, unit: { ...payload, is_active: true } })
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{existing ? 'Edit Unit' : 'Add Selling Unit'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} mt={1}>
          <Controller
            name="unit_name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Unit name"
                size="small"
                fullWidth
                error={!!errors.unit_name}
                helperText={errors.unit_name?.message ?? 'e.g. Piece, Strip, Bottle, Box'}
              />
            )}
          />

          <Controller
            name="conversion_factor"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Conversion factor"
                type="number"
                size="small"
                fullWidth
                error={!!errors.conversion_factor}
                helperText={errors.conversion_factor?.message ?? 'Pieces per unit (e.g. 10 for a strip of 10 tablets)'}
                inputProps={{ min: 0.0001, step: 1 }}
              />
            )}
          />

          {/* Price before VAT */}
          <Controller
            name="price_before_vat"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Selling price before VAT (UGX)"
                type="number"
                size="small"
                fullWidth
                error={!!errors.price_before_vat}
                helperText={errors.price_before_vat?.message}
                inputProps={{ min: 0, step: 100 }}
                onChange={(e) => {
                  field.onChange(parseFloat(e.target.value) || 0)
                  setValue('vat_amount', isVatExempt ? 0 : Math.round((parseFloat(e.target.value) || 0) * (vatRate / 100)))
                }}
              />
            )}
          />

          {/* VAT amount (computed, read-only) */}
          <TextField
            label={`VAT amount (${isVatExempt ? 'Exempt' : vatRate + '%'}) — auto-computed`}
            value={formatUGX(vatAmount)}
            size="small"
            fullWidth
            disabled
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalculateIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />

          {/* Selling price (read-only) */}
          <TextField
            label="Total selling price (UGX) — auto-computed"
            value={formatUGX(sellingPrice)}
            size="small"
            fullWidth
            disabled
            sx={{
              '& .MuiInputBase-root': {
                bgcolor: 'action.hover',
                fontWeight: 700,
              },
            }}
          />

          <Controller
            name="cost_price"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Cost price / purchase price (UGX)"
                type="number"
                size="small"
                fullWidth
                helperText="Used for P&L reports"
                inputProps={{ min: 0, step: 100 }}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            )}
          />

          {!existing && (
            <Controller
              name="is_default"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} />}
                  label="Set as default selling unit"
                />
              )}
            />
          )}

          {isVatExempt && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              This product is marked VAT-exempt — no VAT will be added to this unit's price.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
          {existing ? 'Save changes' : 'Add unit'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function ProductUnitManager({ productId, units, isVatExempt }: Props) {
  const vatRate        = useVatRate()
  const deleteUnit     = useDeleteProductUnit()
  const setDefault     = useSetDefaultUnit()
  const [dialogOpen,   setDialogOpen]   = useState(false)
  const [editingUnit,  setEditingUnit]  = useState<ProductUnit | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1" fontWeight={600}>Selling Units</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => { setEditingUnit(undefined); setDialogOpen(true) }}
        >
          Add unit
        </Button>
      </Box>

      {units.length === 0 ? (
        <Box py={4} textAlign="center" border="1px dashed" borderColor="divider" borderRadius={2}>
          <Typography variant="body2" color="text.secondary">
            No selling units defined. Add at least one unit.
          </Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Unit</TableCell>
              <TableCell align="right">Price (excl. VAT)</TableCell>
              <TableCell align="right">VAT</TableCell>
              <TableCell align="right">Selling Price</TableCell>
              <TableCell align="right">Cost Price</TableCell>
              <TableCell align="center">Default</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {units.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{u.unit_name}</Typography>
                    {u.conversion_factor !== 1 && (
                      <Typography variant="caption" color="text.secondary">
                        × {u.conversion_factor} pieces
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace">
                    {formatUGX(u.price_before_vat)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace">
                    {isVatExempt ? '—' : formatUGX(u.vat_amount)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700} fontFamily="monospace" color="primary.main">
                    {formatUGX(u.selling_price)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                    {formatUGX(u.cost_price)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title={u.is_default ? 'Default unit' : 'Set as default'} arrow>
                    <IconButton
                      size="small"
                      color={u.is_default ? 'warning' : 'default'}
                      onClick={() => !u.is_default && setDefault.mutate({ productId, unitId: u.id })}
                    >
                      {u.is_default ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" justifyContent="flex-end" gap={0.25}>
                    <Tooltip title="Edit" arrow>
                      <IconButton size="small" onClick={() => { setEditingUnit(u); setDialogOpen(true) }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={units.length === 1 ? 'Cannot delete the only unit' : 'Delete'} arrow>
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={units.length === 1}
                          onClick={() => setDeleteConfirm(u.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit dialog */}
      <UnitDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        existing={editingUnit}
        productId={productId}
        isVatExempt={isVatExempt}
        vatRate={vatRate}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete unit?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This cannot be undone. Historical sales data will be preserved.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button variant="outlined" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              deleteUnit.mutate(deleteConfirm!)
              setDeleteConfirm(null)
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

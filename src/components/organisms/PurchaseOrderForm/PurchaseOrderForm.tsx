import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, IconButton, Stack, TextField,
  Autocomplete, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper,
} from '@mui/material'
import CloseIcon  from '@mui/icons-material/Close'
import AddIcon    from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

import { FormSelectField } from '@/components/molecules/FormField/FormField'
import { DeleteConfirmationModal } from '@/components/molecules/DeleteConfirmationModal/DeleteConfirmationModal'
import { useSuppliers }    from '@/hooks/shared/useReferenceData'
import { useProducts }     from '@/hooks/products/useProducts'
import { useCreatePurchaseOrder } from '@/hooks/inventory/usePurchaseOrders'
import { useAuthStore }    from '@/store/authStore'
import { formatUGX }       from '@/lib/formatters'
import { useForm }         from 'react-hook-form'
import type { POItemFormValues } from '@/lib/zod-schemas/inventory.schemas'
import type { ProductWithDetails } from '@/services/productService'

interface Props {
  open:    boolean
  onClose: () => void
}

interface LineItem extends POItemFormValues {
  _id:          string
  product_name: string
  unit_name:    string
}

export function PurchaseOrderForm({ open, onClose }: Props) {
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null)
  const createPO = useCreatePurchaseOrder()

  const { data: suppliers = [] } = useSuppliers()
  const { data: products = [] }  = useProducts()

  const { control, watch } = useForm<{ supplier_id: string }>({
    defaultValues: { supplier_id: '' },
  })
  const supplierId = watch('supplier_id')

  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes]               = useState('')
  const [items, setItems]               = useState<LineItem[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Add item state
  const [selectedProduct, setSelectedProduct] = useState<ProductWithDetails | null>(null)
  const [unitId, setUnitId]                   = useState('')
  const [qty, setQty]                         = useState('')
  const [cost, setCost]                       = useState('')

  const handleAddItem = () => {
    if (!selectedProduct || !unitId || !qty || !cost) return
    const unit = (selectedProduct as any).product_units?.find?.((u: any) => u.id === unitId)
    const newItem: LineItem = {
      _id:                `item-${Date.now()}`,
      product_id:         selectedProduct.id,
      product_unit_id:    unitId,
      quantity_ordered:   parseFloat(qty),
      cost_price_per_unit: parseFloat(cost),
      product_name:       selectedProduct.name,
      unit_name:          unit?.unit_name ?? '—',
    }
    setItems((prev) => [...prev, newItem])
    setSelectedProduct(null)
    setUnitId('')
    setQty('')
    setCost('')
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i._id !== id))
  }

  const subtotal = items.reduce((s, i) => s + i.quantity_ordered * i.cost_price_per_unit, 0)

  const handleSubmit = () => {
    if (!branchId || !supplierId || items.length === 0) return
    createPO.mutate({
      branch_id:              branchId,
      supplier_id:            supplierId,
      expected_delivery_date: expectedDate || null,
      notes:                  notes || null,
      items: items.map(({ product_id, product_unit_id, quantity_ordered, cost_price_per_unit }) => ({
        product_id, product_unit_id, quantity_ordered, cost_price_per_unit,
      })),
    }, {
      onSuccess: () => {
        onClose()
        resetForm()
      },
    })
  }

  const resetForm = () => {
    setItems([])
    setExpectedDate('')
    setNotes('')
  }

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={700} flex={1}>
          New Purchase Order
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          {/* Supplier + delivery date */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormSelectField
              name="supplier_id"
              control={control}
              label="Supplier"
              options={supplierOptions}
              size="small"
            />
            <TextField
              label="Expected Delivery"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline rows={2}
            size="small" fullWidth
          />

          {/* Add item */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" mb={1.5}>Add line item</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
              <Autocomplete
                options={products}
                getOptionLabel={(p) => p.name}
                value={selectedProduct}
                onChange={(_, p) => { setSelectedProduct(p); setUnitId('') }}
                renderInput={(params) => (
                  <TextField {...params} label="Product" size="small" />
                )}
                sx={{ flex: 1, minWidth: 200 }}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                noOptionsText="No products"
              />
              <TextField
                label="Unit"
                select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                size="small"
                sx={{ minWidth: 120 }}
                disabled={!selectedProduct}
              >
                {((selectedProduct as any)?.product_units ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.unit_name}</option>
                ))}
              </TextField>
              <TextField
                label="Qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                size="small"
                sx={{ width: 80 }}
              />
              <TextField
                label="Cost/Unit"
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                size="small"
                sx={{ width: 110 }}
              />
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAddItem}
                disabled={!selectedProduct || !unitId || !qty || !cost}>
                Add
              </Button>
            </Stack>
          </Paper>

          {/* Items table */}
          {items.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Cost/Unit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Line Total</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.unit_name}</TableCell>
                      <TableCell align="right">{item.quantity_ordered}</TableCell>
                      <TableCell align="right">{formatUGX(item.cost_price_per_unit)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatUGX(item.quantity_ordered * item.cost_price_per_unit)}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(i)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} align="right">
                      <Typography variant="subtitle2">Subtotal</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" fontFamily="monospace">{formatUGX(subtotal)}</Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </DialogContent>

      {/* Delete confirmation modal */}
      <DeleteConfirmationModal
        open={deleteConfirm !== null}
        title="Remove item from purchase order?"
        itemName={deleteConfirm !== null ? `${items[deleteConfirm]?.product_name} (${items[deleteConfirm]?.unit_name})` : ''}
        description="You are about to remove"
        warningMessage="This item will be removed from the purchase order."
        isPending={false}
        onConfirm={() => {
          if (deleteConfirm !== null) {
            removeItem(items[deleteConfirm]._id)
            setDeleteConfirm(null)
          }
        }}
        onClose={() => setDeleteConfirm(null)}
        confirmButtonText="Remove"
      />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={createPO.isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={createPO.isPending || !supplierId || items.length === 0}
        >
          {createPO.isPending ? 'Creating…' : 'Create Purchase Order'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

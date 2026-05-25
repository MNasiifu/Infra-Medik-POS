import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supplierSchema, type SupplierFormValues } from '@/lib/zod-schemas/catalog.schemas'
import { useCreateSupplier, useUpdateSupplier } from '@/hooks/suppliers/useSupplierMutations'
import type { Supplier } from '@/types/database.types'

interface Props {
  open: boolean
  onClose: () => void
  existing?: Supplier
}

export function SupplierForm({ open, onClose, existing }: Props) {
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          contact_person: existing.contact_person,
          phone: existing.phone,
          email: existing.email ?? '',
          address: existing.address,
          tin: existing.tin,
          notes: existing.notes,
        }
      : {
          name: '',
          contact_person: null,
          phone: null,
          email: '',
          address: null,
          tin: null,
          notes: null,
        },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = async (values: SupplierFormValues) => {
    const payload = {
      name: values.name,
      contact_person: values.contact_person || null,
      phone: values.phone || null,
      email: values.email?.trim() || null,
      address: values.address || null,
      tin: values.tin || null,
      notes: values.notes || null,
    }
    if (existing) {
      await updateSupplier.mutateAsync({ id: existing.id, data: payload })
    } else {
      await createSupplier.mutateAsync(payload)
    }
    handleClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{existing ? 'Edit supplier' : 'Add supplier'}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Name *"
                    size="small"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="contact_person"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Contact person"
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Phone"
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Email"
                    size="small"
                    fullWidth
                    error={!!errors.email}
                    helperText={errors.email?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="tin"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="TIN"
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="address"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Address"
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Notes"
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {existing ? 'Save changes' : 'Create supplier'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  manufacturerSchema,
  type ManufacturerFormValues,
} from '@/lib/zod-schemas/catalog.schemas'
import {
  useCreateManufacturer,
  useUpdateManufacturer,
} from '@/hooks/manufacturers/useManufacturerMutations'
import { useCountries } from '@/hooks/shared/useReferenceData'
import type { Manufacturer } from '@/types/database.types'

interface Props {
  open: boolean
  onClose: () => void
  existing?: Manufacturer
}

export function ManufacturerForm({ open, onClose, existing }: Props) {
  const createManufacturer = useCreateManufacturer()
  const updateManufacturer = useUpdateManufacturer()
  const { data: countries = [] } = useCountries()

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<ManufacturerFormValues>({
    resolver: zodResolver(manufacturerSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          country_id: existing.country_id ?? '',
          website: existing.website ?? '',
        }
      : { name: '', country_id: '', website: '' },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = async (values: ManufacturerFormValues) => {
    const payload = {
      name: values.name,
      country_id: values.country_id || null,
      website: values.website?.trim() || null,
    }
    if (existing) {
      await updateManufacturer.mutateAsync({ id: existing.id, data: payload })
    } else {
      await createManufacturer.mutateAsync(payload)
    }
    handleClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{existing ? 'Edit manufacturer' : 'Add manufacturer'}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Name *"
                size="small"
                fullWidth
                margin="normal"
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
          <Controller
            name="country_id"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel>Country</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Country">
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {countries.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          <Controller
            name="website"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                label="Website"
                size="small"
                fullWidth
                margin="normal"
                error={!!errors.website}
                helperText={errors.website?.message}
              />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {existing ? 'Save changes' : 'Create manufacturer'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

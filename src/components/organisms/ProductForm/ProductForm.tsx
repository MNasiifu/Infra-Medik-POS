import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Chip, Divider, FormControl, FormControlLabel,
  Grid, IconButton, InputAdornment, InputLabel, MenuItem,
  Paper, Select, Stack, Switch, Tab, Tabs, TextField,
  Tooltip, Typography, Alert,
} from '@mui/material'
import AddIcon       from '@mui/icons-material/Add'
import DeleteIcon    from '@mui/icons-material/Delete'
import StarIcon      from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import CalculateIcon from '@mui/icons-material/Calculate'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  createProductSchema, productSchema,
  DOSAGE_FORMS,
  type CreateProductFormValues, type ProductFormValues,
} from '@/lib/zod-schemas/product.schemas'
import { useCreateProduct, useUpdateProduct, useUpdateProductUnit } from '@/hooks/products/useProductMutations'
import { useCategories, useManufacturers, useCountries, useSuppliers } from '@/hooks/shared/useReferenceData'
import { useVatRate } from '@/hooks/shared/useVatRate'
import { ProductUnitManager } from '@/components/organisms/ProductUnitManager/ProductUnitManager'
import { BarcodeManager }     from '@/components/organisms/BarcodeManager/BarcodeManager'
import { formatUGX }          from '@/lib/formatters'
import type { ProductWithDetails } from '@/services/productService'

// ─── Inline unit builder (create mode only) ────────────────────

function UnitRow({
  index, vatRate, isVatExempt, control, errors, remove, isDefault, setDefault, isLast,
}: {
  index:       number
  vatRate:     number
  isVatExempt: boolean
  control:     ReturnType<typeof useForm<CreateProductFormValues>>['control']
  errors:      CreateProductFormValues['units'][number] | undefined
  remove:      () => void
  isDefault:   boolean
  setDefault:  () => void
  isLast:      boolean
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title={isDefault ? 'Default unit' : 'Set as default'} arrow>
            <IconButton size="small" color={isDefault ? 'warning' : 'default'} onClick={setDefault}>
              {isDefault ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          {isDefault && <Chip label="Default" size="small" color="warning" variant="outlined" sx={{ borderRadius: '6px' }} />}
        </Box>
        <Tooltip title={isLast ? 'Cannot delete the only unit' : 'Remove unit'} arrow>
          <span>
            <IconButton size="small" color="error" disabled={isLast} onClick={remove}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Controller
            name={`units.${index}.unit_name`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Unit name *"
                size="small"
                fullWidth
                error={!!errors?.unit_name}
                helperText={(errors as unknown as Record<string, { message?: string } | undefined>)?.unit_name?.message ?? 'e.g. Piece, Strip, Box'}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name={`units.${index}.conversion_factor`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Conversion factor"
                type="number"
                size="small"
                fullWidth
                inputProps={{ min: 0.0001, step: 1 }}
                // @ts-expect-error
                helperText={errors?.conversion_factor?.message ?? 'Pieces per unit'}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
              />
            )}
          />
        </Grid>

        <UnitPriceFields index={index} vatRate={vatRate} isVatExempt={isVatExempt} control={control} />
      </Grid>
    </Paper>
  )
}

function UnitPriceFields({
  index, vatRate, isVatExempt, control,
}: {
  index:       number
  vatRate:     number
  isVatExempt: boolean
  control:     ReturnType<typeof useForm<CreateProductFormValues>>['control']
}) {
  return (
    <>
      <Grid item xs={12} sm={4}>
        <Controller
          name={`units.${index}.price_before_vat`}
          control={control}
          render={({ field, formState }) => (
            <TextField
              {...field}
              label="Price before VAT (UGX)"
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 0, step: 100 }}
              error={!!(formState.errors.units as undefined | Record<number, { price_before_vat?: unknown }>)?.[index]?.price_before_vat}
              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
            />
          )}
        />
      </Grid>

      <Grid item xs={12} sm={4}>
        <Controller
          name={`units.${index}.price_before_vat`}
          control={control}
          render={({ field }) => {
            const vatAmt = isVatExempt ? 0 : Math.round((field.value ?? 0) * (vatRate / 100))
            return (
              <TextField
                label={`VAT (${isVatExempt ? 'Exempt' : vatRate + '%'})`}
                value={formatUGX(vatAmt)}
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
            )
          }}
        />
      </Grid>

      <Grid item xs={12} sm={4}>
        <Controller
          name={`units.${index}.price_before_vat`}
          control={control}
          render={({ field }) => {
            const vatAmt = isVatExempt ? 0 : Math.round((field.value ?? 0) * (vatRate / 100))
            const total  = (field.value ?? 0) + vatAmt
            return (
              <TextField
                label="Selling price (UGX)"
                value={formatUGX(total)}
                size="small"
                fullWidth
                disabled
                sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover', fontWeight: 700 } }}
              />
            )
          }}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <Controller
          name={`units.${index}.cost_price`}
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Cost price (UGX)"
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 0, step: 100 }}
              helperText="Used for P&L reports"
              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
            />
          )}
        />
      </Grid>
    </>
  )
}

// ─── Inline unit builder wrapper ───────────────────────────────

function UnitInlineBuilder({
  control, errors, vatRate, isVatExempt,
}: {
  control:     ReturnType<typeof useForm<CreateProductFormValues>>['control']
  errors:      CreateProductFormValues
  vatRate:     number
  isVatExempt: boolean
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'units' })
  const [defaultIdx, setDefaultIdx] = useState(0)

  const addUnit = () => {
    append({
      unit_name:         'Piece',
      conversion_factor: 1,
      price_before_vat:  0,
      vat_amount:        0,
      cost_price:        0,
      is_default:        false,
    })
  }

  return (
    <Stack spacing={2}>
      {fields.map((field, i) => (
        <UnitRow
          key={field.id}
          index={i}
          vatRate={vatRate}
          isVatExempt={isVatExempt}
          control={control}
          errors={(errors as { units?: Record<number, CreateProductFormValues['units'][number]> })?.units?.[i]}
          remove={() => { remove(i); if (defaultIdx === i) setDefaultIdx(0) }}
          isDefault={defaultIdx === i}
          setDefault={() => setDefaultIdx(i)}
          isLast={fields.length === 1}
        />
      ))}

      <Button
        variant="outlined"
        size="small"
        startIcon={<AddIcon />}
        onClick={addUnit}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add another unit
      </Button>
    </Stack>
  )
}

// ─── Barcode input list (create mode only) ─────────────────────

function BarcodesInlineBuilder({
  control,
}: {
  control: ReturnType<typeof useForm<CreateProductFormValues>>['control']
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'barcodes' as unknown as 'units',
  })

  return (
    <Stack spacing={1.5}>
      {fields.map((field, i) => (
        <Box key={field.id} display="flex" gap={1} alignItems="center">
          <Controller
            name={`barcodes.${i}` as `units.${number}.unit_name`}
            control={control}
            render={({ field: f }) => (
              <TextField
                {...f}
                label={`Barcode ${i + 1}`}
                size="small"
                sx={{ flex: 1 }}
                placeholder="Type or scan"
              />
            )}
          />
          <IconButton size="small" color="error" onClick={() => remove(i)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button
        variant="outlined"
        size="small"
        startIcon={<AddIcon />}
        // @ts-expect-error – append string
        onClick={() => append('')}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add barcode
      </Button>
      {fields.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No barcodes added. You can add them after saving the product.
        </Typography>
      )}
    </Stack>
  )
}

// ─── Tab panel helper ──────────────────────────────────────────

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box pt={3}>{children}</Box> : null
}

// ─── CREATE form ───────────────────────────────────────────────

function CreateProductForm() {
  const vatRate    = useVatRate()
  const navigate   = useNavigate()
  const createProd = useCreateProduct()
  const [tab, setTab] = useState(0)

  const {
    control, handleSubmit, watch, formState: { errors, isSubmitting },
  } = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      product: {
        name:            '',
        generic_name:    null,
        category_id:     null,
        manufacturer_id: null,
        country_id:      null,
        supplier_id:     null,
        dosage_form:     null,
        strength:        null,
        description:     null,
        is_vat_exempt:   false,
      },
      units: [
        {
          unit_name:         'Piece',
          conversion_factor: 1,
          price_before_vat:  0,
          vat_amount:        0,
          cost_price:        0,
          is_default:        true,
        },
      ],
      barcodes: [],
    },
  })

  const isVatExempt = watch('product.is_vat_exempt') ?? false

  const onSubmit = async (values: CreateProductFormValues) => {
    const barcodes = (values.barcodes ?? [])
      .filter(Boolean)
      .map((b) => ({ barcode: b, is_generated: false }))
    const units = values.units.map((u, i) => ({
      ...u,
      is_default: i === 0,
      is_active:  true,
      vat_amount: isVatExempt ? 0 : Math.round(u.price_before_vat * (vatRate / 100)),
    }))
    await createProd.mutateAsync([
      {
        ...values.product,
        generic_name:    values.product.generic_name    ?? null,
        category_id:     values.product.category_id     ?? null,
        manufacturer_id: values.product.manufacturer_id ?? null,
        country_id:      values.product.country_id      ?? null,
        supplier_id:     values.product.supplier_id     ?? null,
        dosage_form:     values.product.dosage_form     ?? null,
        strength:        values.product.strength        ?? null,
        description:     values.product.description     ?? null,
        is_active:  true,
        created_by: null,
        image_url:  null,
      },
      units,
      barcodes,
    ])
    navigate('/products')
  }

  return (
    <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Product details" />
          <Tab label="Selling units" />
          <Tab label="Barcodes" />
        </Tabs>
      </Box>

      <TabPanel value={tab} index={0}>
        {/* ProductFields needs polymorphic field names under "product.*" in create mode */}
        <CreateProductFields control={control} errors={(errors.product as Record<string, { message?: string } | undefined>) ?? {}} watch={watch} />
      </TabPanel>

      <TabPanel value={tab} index={1}>
        {errors.units && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {(errors.units as { message?: string }).message ?? 'Please fix unit errors'}
          </Alert>
        )}
        <UnitInlineBuilder
          control={control}
          errors={errors as unknown as CreateProductFormValues}
          vatRate={vatRate}
          isVatExempt={isVatExempt}
        />
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <BarcodesInlineBuilder control={control} />
      </TabPanel>

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
        <Button variant="outlined" onClick={() => navigate('/products')} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="contained" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Create product'}
        </Button>
      </Stack>
    </Box>
  )
}

// Create mode field names are nested under "product.*"
function CreateProductFields({
  control, errors, watch,
}: {
  control: ReturnType<typeof useForm<CreateProductFormValues>>['control']
  errors:  Record<string, { message?: string } | undefined>
  watch:   ReturnType<typeof useForm<CreateProductFormValues>>['watch']
}) {
  const { data: categories    = [] } = useCategories()
  const { data: manufacturers = [] } = useManufacturers()
  const { data: countries     = [] } = useCountries()
  const { data: suppliers     = [] } = useSuppliers()
  const isVatExempt = watch('product.is_vat_exempt') ?? false

  return (
    <Grid container spacing={2.5}>
      <Grid item xs={12} md={6}>
        <Controller name="product.name" control={control} render={({ field }) => (
          <TextField {...field} label="Product name *" size="small" fullWidth
            error={!!errors.name} helperText={(errors.name as { message?: string })?.message} />
        )} />
      </Grid>
      <Grid item xs={12} md={6}>
        <Controller name="product.generic_name" control={control} render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Generic name (INN)"
            size="small" fullWidth helperText="International non-proprietary name" />
        )} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Controller name="product.category_id" control={control} render={({ field }) => (
          <FormControl size="small" fullWidth>
            <InputLabel>Category</InputLabel>
            <Select {...field} value={field.value ?? ''} label="Category">
              <MenuItem value=""><em>None</em></MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
        )} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Controller name="product.dosage_form" control={control} render={({ field }) => (
          <FormControl size="small" fullWidth>
            <InputLabel>Dosage form</InputLabel>
            <Select {...field} value={field.value ?? ''} label="Dosage form">
              <MenuItem value=""><em>None</em></MenuItem>
              {DOSAGE_FORMS.map((f) => (
                <MenuItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Controller name="product.strength" control={control} render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Capacity" size="small" fullWidth
            helperText="e.g. 500mg, 10mg/5ml" />
        )} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Controller name="product.manufacturer_id" control={control} render={({ field }) => (
          <FormControl size="small" fullWidth>
            <InputLabel>Manufacturer</InputLabel>
            <Select {...field} value={field.value ?? ''} label="Manufacturer">
              <MenuItem value=""><em>None</em></MenuItem>
              {manufacturers.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
            </Select>
          </FormControl>
        )} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Controller name="product.country_id" control={control} render={({ field }) => (
          <FormControl size="small" fullWidth>
            <InputLabel>Country of origin</InputLabel>
            <Select {...field} value={field.value ?? ''} label="Country of origin">
              <MenuItem value=""><em>None</em></MenuItem>
              {countries.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
        )} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Controller name="product.supplier_id" control={control} render={({ field }) => (
          <FormControl size="small" fullWidth>
            <InputLabel>Default supplier</InputLabel>
            <Select {...field} value={field.value ?? ''} label="Default supplier">
              <MenuItem value=""><em>None</em></MenuItem>
              {suppliers.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
        )} />
      </Grid>
      <Grid item xs={12}>
        <Controller name="product.description" control={control} render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Description / notes"
            size="small" fullWidth multiline rows={2} />
        )} />
      </Grid>
      <Grid item xs={12}>
        <Controller name="product.is_vat_exempt" control={control} render={({ field }) => (
          <FormControlLabel
            control={<Switch {...field} checked={field.value ?? false} />}
            label="VAT-exempt product (no 18% VAT applied at sale)"
          />
        )} />
        {isVatExempt && (
          <Alert severity="warning" sx={{ mt: 1, borderRadius: 2 }}>
            Marking this product as VAT-exempt means no VAT will be collected on any of its selling units.
          </Alert>
        )}
      </Grid>
    </Grid>
  )
}

// ─── EDIT form ─────────────────────────────────────────────────

function EditProductForm({ product }: { product: ProductWithDetails }) {
  const navigate    = useNavigate()
  const updateProd  = useUpdateProduct()
  const updateUnit  = useUpdateProductUnit()
  const vatRate     = useVatRate()
  const [tab, setTab] = useState(0)

  const {
    control, handleSubmit, watch, formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name:            product.name,
      generic_name:    product.generic_name,
      category_id:     product.category_id,
      manufacturer_id: product.manufacturer_id,
      country_id:      product.country_id,
      supplier_id:     product.supplier_id,
      dosage_form:     product.dosage_form,
      strength:        product.strength,
      description:     product.description,
      is_vat_exempt:   product.is_vat_exempt,
    },
  })

  const isVatExempt = watch('is_vat_exempt')

  const onSubmit = async (values: ProductFormValues) => {
    await updateProd.mutateAsync({ id: product.id, data: values })

    const vatChanged = values.is_vat_exempt !== product.is_vat_exempt
    if (vatChanged) {
      await Promise.all(
        product.product_units.map((u) => {
          const newVat = values.is_vat_exempt
            ? 0
            : Math.round(u.price_before_vat * (vatRate / 100))
          return updateUnit.mutateAsync({ unitId: u.id, data: { vat_amount: newVat } })
        }),
      )
    }
  }

  const { data: categories    = [] } = useCategories()
  const { data: manufacturers = [] } = useManufacturers()
  const { data: countries     = [] } = useCountries()
  const { data: suppliers     = [] } = useSuppliers()

  return (
    <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Product details" />
          <Tab label={`Selling units (${product.product_units.length})`} />
          <Tab label={`Barcodes (${product.product_barcodes.length})`} />
        </Tabs>
      </Box>

      {/* Details tab */}
      <TabPanel value={tab} index={0}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Controller name="name" control={control} render={({ field }) => (
              <TextField {...field} label="Product name *" size="small" fullWidth
                error={!!errors.name} helperText={errors.name?.message} />
            )} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Controller name="generic_name" control={control} render={({ field }) => (
              <TextField {...field} value={field.value ?? ''} label="Generic name (INN)"
                size="small" fullWidth helperText="International non-proprietary name" />
            )} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Controller name="category_id" control={control} render={({ field }) => (
              <FormControl size="small" fullWidth>
                <InputLabel>Category</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Category">
                  <MenuItem value=""><em>None</em></MenuItem>
                  {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            )} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Controller name="dosage_form" control={control} render={({ field }) => (
              <FormControl size="small" fullWidth>
                <InputLabel>Dosage form</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Dosage form">
                  <MenuItem value=""><em>None</em></MenuItem>
                  {DOSAGE_FORMS.map((f) => (
                    <MenuItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Controller name="strength" control={control} render={({ field }) => (
              <TextField {...field} value={field.value ?? ''} label="Capacity" size="small" fullWidth
                helperText="e.g. 500mg, 10mg/5ml" />
            )} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Controller name="manufacturer_id" control={control} render={({ field }) => (
              <FormControl size="small" fullWidth>
                <InputLabel>Manufacturer</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Manufacturer">
                  <MenuItem value=""><em>None</em></MenuItem>
                  {manufacturers.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                </Select>
              </FormControl>
            )} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Controller name="country_id" control={control} render={({ field }) => (
              <FormControl size="small" fullWidth>
                <InputLabel>Country of origin</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Country of origin">
                  <MenuItem value=""><em>None</em></MenuItem>
                  {countries.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            )} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Controller name="supplier_id" control={control} render={({ field }) => (
              <FormControl size="small" fullWidth>
                <InputLabel>Default supplier</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Default supplier">
                  <MenuItem value=""><em>None</em></MenuItem>
                  {suppliers.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            )} />
          </Grid>
          <Grid item xs={12}>
            <Controller name="description" control={control} render={({ field }) => (
              <TextField {...field} value={field.value ?? ''} label="Description / notes"
                size="small" fullWidth multiline rows={2} />
            )} />
          </Grid>
          <Grid item xs={12}>
            <Controller name="is_vat_exempt" control={control} render={({ field }) => (
              <FormControlLabel
                control={<Switch {...field} checked={field.value ?? false} />}
                label="VAT-exempt product (no 18% VAT applied at sale)"
              />
            )} />
            {isVatExempt && (
              <Alert severity="warning" sx={{ mt: 1, borderRadius: 2 }}>
                Changing VAT exemption will not retroactively alter historical sales.
              </Alert>
            )}
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
          <Button variant="outlined" onClick={() => navigate(`/products/${product.id}`)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </Stack>
      </TabPanel>

      {/* Units tab */}
      <TabPanel value={tab} index={1}>
        <ProductUnitManager
          productId={product.id}
          units={product.product_units}
          isVatExempt={isVatExempt ?? false}
        />
      </TabPanel>

      {/* Barcodes tab */}
      <TabPanel value={tab} index={2}>
        <BarcodeManager
          productId={product.id}
          barcodes={product.product_barcodes as import('@/types/database.types').ProductBarcode[]}
          productName={product.name}
        />
      </TabPanel>
    </Box>
  )
}

// ─── Public entry point ────────────────────────────────────────

interface Props {
  product?: ProductWithDetails
}

export function ProductForm({ product }: Props) {
  const navigate = useNavigate()

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <Tooltip title={product ? 'Back to product details' : 'Back to products'} arrow>
          <IconButton size="small" onClick={() => navigate(product ? `/products/${product.id}` : '/products')}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {product ? product.name : 'New product'}
          </Typography>
          {product?.generic_name && (
            <Typography variant="body2" color="text.secondary">{product.generic_name}</Typography>
          )}
        </Box>
        {product && (
          <Chip
            label={product.is_active ? 'Active' : 'Inactive'}
            size="small"
            color={product.is_active ? 'success' : 'default'}
            variant={product.is_active ? 'filled' : 'outlined'}
            sx={{ borderRadius: '6px', ml: 'auto' }}
          />
        )}
      </Box>

      {product ? <EditProductForm product={product} /> : <CreateProductForm />}
    </Box>
  )
}

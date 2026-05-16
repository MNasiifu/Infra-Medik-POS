import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Chip, IconButton, Tooltip, TextField, MenuItem,
  InputAdornment, Stack, Button, Typography, Select,
  FormControl, InputLabel, Switch, FormControlLabel,
} from '@mui/material'
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import SearchIcon      from '@mui/icons-material/Search'
import EditIcon        from '@mui/icons-material/Edit'
import ToggleOnIcon    from '@mui/icons-material/ToggleOn'
import ToggleOffIcon   from '@mui/icons-material/ToggleOff'
import AddIcon         from '@mui/icons-material/Add'
import FilterListIcon  from '@mui/icons-material/FilterList'

import { useProducts } from '@/hooks/products/useProducts'
import { useToggleProductActive } from '@/hooks/products/useProductMutations'
import { useCategories } from '@/hooks/shared/useReferenceData'
import { formatUGX } from '@/lib/formatters'
import type { ProductWithDetails } from '@/services/productService'
import type { DosageForm } from '@/types/database.types'

const DOSAGE_COLORS: Record<DosageForm, string> = {
  tablet:     '#1565C0',
  capsule:    '#6A1B9A',
  syrup:      '#00838F',
  suspension: '#0277BD',
  cream:      '#2E7D32',
  ointment:   '#558B2F',
  gel:        '#00695C',
  injection:  '#C62828',
  drops:      '#F57F17',
  powder:     '#4E342E',
  inhaler:    '#283593',
  patch:      '#4527A0',
  suppository:'#37474F',
  other:      '#546E7A',
}

export function ProductTable() {
  const navigate = useNavigate()
  const [search,       setSearch]       = useState('')
  const [categoryId,   setCategoryId]   = useState('')
  const [dosageForm,   setDosageForm]   = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showFilters,  setShowFilters]  = useState(false)

  const { data: products = [], isLoading } = useProducts({
    search:       search || undefined,
    categoryId:   categoryId || undefined,
    dosageForm:   dosageForm || undefined,
    showInactive,
  })
  const { data: categories = [] } = useCategories()
  const toggleActive = useToggleProductActive()

  const columns: GridColDef<ProductWithDetails>[] = useMemo(() => [
    {
      field: 'name',
      headerName: 'Product',
      flex: 1.8,
      minWidth: 200,
      renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) => (
        <Box py={0.5}>
          <Typography variant="body2" fontWeight={600} lineHeight={1.3}>
            {row.name}
          </Typography>
          {row.generic_name && (
            <Typography variant="caption" color="text.secondary" lineHeight={1.2} display="block">
              {row.generic_name}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'category',
      headerName: 'Category',
      flex: 1,
      minWidth: 130,
      valueGetter: (_: unknown, row: ProductWithDetails) => row.categories?.name ?? '—',
      renderCell: ({ value }: GridRenderCellParams) =>
        value === '—' ? (
          <Typography variant="caption" color="text.disabled">—</Typography>
        ) : (
          <Chip label={value} size="small" variant="outlined" sx={{ borderRadius: '6px', fontSize: '0.75rem' }} />
        ),
    },
    {
      field: 'dosage_form',
      headerName: 'Form',
      width: 120,
      renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) =>
        row.dosage_form ? (
          <Chip
            label={row.dosage_form.charAt(0).toUpperCase() + row.dosage_form.slice(1)}
            size="small"
            sx={{
              borderRadius: '6px',
              fontSize: '0.75rem',
              bgcolor: DOSAGE_COLORS[row.dosage_form] + '18',
              color:   DOSAGE_COLORS[row.dosage_form],
              fontWeight: 600,
              border: `1px solid ${DOSAGE_COLORS[row.dosage_form]}40`,
            }}
          />
        ) : <Typography variant="caption" color="text.disabled">—</Typography>,
    },
    {
      field: 'strength',
      headerName: 'Strength',
      width: 110,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'}>
          {value ?? '—'}
        </Typography>
      ),
    },
    {
      field: 'selling_price',
      headerName: 'Price (UGX)',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      valueGetter: (_: unknown, row: ProductWithDetails) => {
        const defaultUnit = row.product_units?.find((u) => u.is_default)
        return defaultUnit?.selling_price ?? 0
      },
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600} fontFamily="monospace">
          {formatUGX(value as number)}
        </Typography>
      ),
    },
    {
      field: 'is_vat_exempt',
      headerName: 'VAT',
      width: 80,
      renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) =>
        row.is_vat_exempt ? (
          <Chip label="Exempt" size="small" color="warning" variant="outlined" sx={{ borderRadius: '6px', fontSize: '0.7rem' }} />
        ) : (
          <Chip label="18%" size="small" color="default" variant="outlined" sx={{ borderRadius: '6px', fontSize: '0.7rem' }} />
        ),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 90,
      renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) => (
        <Chip
          label={row.is_active ? 'Active' : 'Inactive'}
          size="small"
          color={row.is_active ? 'success' : 'default'}
          variant={row.is_active ? 'filled' : 'outlined'}
          sx={{ borderRadius: '6px', fontSize: '0.7rem' }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 90,
      sortable: false,
      filterable: false,
      renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) => (
        <Box display="flex" gap={0.25}>
          <Tooltip title="Edit product" arrow>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); navigate(`/products/${row.id}`) }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={row.is_active ? 'Deactivate' : 'Activate'} arrow>
            <IconButton
              size="small"
              color={row.is_active ? 'error' : 'success'}
              onClick={(e) => {
                e.stopPropagation()
                toggleActive.mutate({ id: row.id, isActive: !row.is_active })
              }}
            >
              {row.is_active
                ? <ToggleOffIcon fontSize="small" />
                : <ToggleOnIcon  fontSize="small" />
              }
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [navigate, toggleActive])

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2} alignItems="flex-start">
        <TextField
          placeholder="Search by name, generic name, or barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1, maxWidth: { sm: 380 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />

        <Button
          variant={showFilters ? 'contained' : 'outlined'}
          size="small"
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters((v) => !v)}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Filters
        </Button>

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => navigate('/products/new')}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Add Product
        </Button>
      </Stack>

      {/* Filter panel */}
      {showFilters && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              label="Category"
            >
              <MenuItem value="">All categories</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Dosage form</InputLabel>
            <Select
              value={dosageForm}
              onChange={(e) => setDosageForm(e.target.value)}
              label="Dosage form"
            >
              <MenuItem value="">All forms</MenuItem>
              {['tablet','capsule','syrup','cream','injection','drops','other'].map((f) => (
                <MenuItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="body2">Show inactive</Typography>}
          />
        </Stack>
      )}

      {/* Data grid */}
      <DataGrid
        rows={products}
        columns={columns}
        loading={isLoading}
        autoHeight
        density="comfortable"
        disableRowSelectionOnClick
        onRowClick={({ row }) => navigate(`/products/${row.id}`)}
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-cell': { alignItems: 'center' },
        }}
        slotProps={{
          noRowsOverlay: {
            sx: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
          },
        }}
      />
    </Box>
  )
}

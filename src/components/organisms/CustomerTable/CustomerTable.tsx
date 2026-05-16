import { useState, useMemo } from 'react'
import {
  Box, Button, Chip, IconButton, InputAdornment, Stack,
  Switch, FormControlLabel, TextField, Tooltip, Typography,
} from '@mui/material'
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import SearchIcon   from '@mui/icons-material/Search'
import EditIcon     from '@mui/icons-material/Edit'
import DeleteIcon   from '@mui/icons-material/Delete'
import AddIcon      from '@mui/icons-material/Add'
import ToggleOnIcon  from '@mui/icons-material/ToggleOn'
import ToggleOffIcon from '@mui/icons-material/ToggleOff'

import { useCustomers }                                           from '@/hooks/customers/useCustomers'
import { useDeleteCustomer, useToggleCustomerActive }             from '@/hooks/customers/useCustomerMutations'
import { CustomerForm }                                           from '@/components/organisms/CustomerForm/CustomerForm'
import { formatDate }                                             from '@/lib/formatters'
import type { Customer } from '@/types/database.types'

const TYPE_LABELS: Record<string, string> = {
  walk_in:  'Walk-in',
  account:  'Account',
  delivery: 'Delivery',
}

export function CustomerTable() {
  const [search,       setSearch]       = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [dialogOpen,   setDialogOpen]   = useState(false)
  const [editing,      setEditing]      = useState<Customer | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null)

  const { data: customers = [], isLoading } = useCustomers({ search, showInactive })
  const toggleActive = useToggleCustomerActive()
  const deleteCustomer = useDeleteCustomer()

  const columns: GridColDef<Customer>[] = useMemo(() => [
    {
      field: 'full_name',
      headerName: 'Name',
      flex: 1.5,
      minWidth: 180,
      renderCell: ({ row }: GridRenderCellParams<Customer>) => (
        <Box py={0.5}>
          <Typography variant="body2" fontWeight={600}>{row.full_name}</Typography>
          {row.email && (
            <Typography variant="caption" color="text.secondary" display="block">{row.email}</Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 150,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'}>
          {value ?? '—'}
        </Typography>
      ),
    },
    {
      field: 'customer_type',
      headerName: 'Type',
      width: 110,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Chip
          label={TYPE_LABELS[value] ?? value}
          size="small"
          variant="outlined"
          sx={{ borderRadius: '6px', fontSize: '0.7rem' }}
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Joined',
      width: 120,
      valueFormatter: (v: string) => formatDate(v),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 90,
      renderCell: ({ row }: GridRenderCellParams<Customer>) => (
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
      width: 100,
      sortable: false,
      renderCell: ({ row }: GridRenderCellParams<Customer>) => (
        <Box display="flex" gap={0.25}>
          <Tooltip title="Edit" arrow>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditing(row); setDialogOpen(true) }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={row.is_active ? 'Deactivate' : 'Activate'} arrow>
            <IconButton
              size="small"
              color={row.is_active ? 'error' : 'success'}
              onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: row.id, isActive: !row.is_active }) }}
            >
              {row.is_active ? <ToggleOffIcon fontSize="small" /> : <ToggleOnIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" arrow>
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(row) }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [toggleActive])

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2} alignItems="flex-start">
        <TextField
          placeholder="Search by name, phone, or email…"
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
        <FormControlLabel
          control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Show inactive</Typography>}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => { setEditing(undefined); setDialogOpen(true) }}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Add customer
        </Button>
      </Stack>

      <DataGrid
        rows={customers}
        columns={columns}
        loading={isLoading}
        autoHeight
        density="comfortable"
        disableRowSelectionOnClick
        pageSizeOptions={[25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          '& .MuiDataGrid-cell': { alignItems: 'center' },
        }}
      />

      <CustomerForm
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        existing={editing}
      />

      {/* Delete confirm */}
      {deleteConfirm && (
        <Box
          position="fixed"
          sx={{ inset: 0 }}
          bgcolor="rgba(0,0,0,0.5)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1400}
          onClick={() => setDeleteConfirm(null)}
        >
          <Box
            bgcolor="background.paper"
            borderRadius={2}
            p={3}
            maxWidth={360}
            width="100%"
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" fontWeight={700} mb={1}>Delete customer?</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              "{deleteConfirm.full_name}" will be soft-deleted. Historical sales data is preserved.
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => { deleteCustomer.mutate(deleteConfirm.id); setDeleteConfirm(null) }}
              >
                Delete
              </Button>
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  )
}

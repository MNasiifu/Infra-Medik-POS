import { useState, useMemo } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Switch,
  FormControlLabel,
  Tooltip,
  Typography,
} from '@mui/material'
import { type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import { AppDataGrid } from '@/components/molecules/AppDataGrid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { useSuppliersList } from '@/hooks/suppliers/useSuppliers'
import { useDeactivateSupplier } from '@/hooks/suppliers/useSupplierMutations'
import { usePermissions } from '@/hooks/auth/usePermissions'
import { SupplierForm } from '@/components/organisms/SupplierForm/SupplierForm'
import { DeactivateConfirmModal } from '@/components/molecules/DeactivateConfirmModal/DeactivateConfirmModal'
import { SearchTextField } from '@/components/molecules/SearchTextField'
import { formatDate } from '@/lib/formatters'
import type { Supplier } from '@/types/database.types'

export function SupplierTable() {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | undefined>()
  const [deactivateTarget, setDeactivateTarget] = useState<Supplier | null>(null)

  const { canDeactivateCatalog } = usePermissions()
  const { data: suppliers = [], isLoading } = useSuppliersList({ search, showInactive })
  const deactivate = useDeactivateSupplier()

  const columns: GridColDef<Supplier>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1.5,
        minWidth: 180,
        renderCell: ({ row }: GridRenderCellParams<Supplier>) => (
          <Box py={0.5}>
            <Typography variant="body2" fontWeight={600}>
              {row.name}
            </Typography>
            {row.contact_person && (
              <Typography variant="caption" color="text.secondary" display="block">
                {row.contact_person}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: 'phone',
        headerName: 'Phone',
        width: 130,
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'}>
            {value ?? '—'}
          </Typography>
        ),
      },
      {
        field: 'email',
        headerName: 'Email',
        flex: 1,
        minWidth: 160,
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'} noWrap>
            {value ?? '—'}
          </Typography>
        ),
      },
      {
        field: 'created_at',
        headerName: 'Created',
        width: 120,
        valueFormatter: (v: string) => formatDate(v),
      },
      {
        field: 'is_active',
        headerName: 'Status',
        width: 90,
        renderCell: ({ row }: GridRenderCellParams<Supplier>) => (
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
        width: canDeactivateCatalog ? 90 : 50,
        sortable: false,
        renderCell: ({ row }: GridRenderCellParams<Supplier>) => (
          <Box display="flex" gap={0.25}>
            <Tooltip title="Edit" arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(row)
                  setDialogOpen(true)
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {canDeactivateCatalog && row.is_active && (
              <Tooltip title="Deactivate" arrow>
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeactivateTarget(row)
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
      },
    ],
    [canDeactivateCatalog],
  )

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2} alignItems="flex-start">
        <SearchTextField
          placeholder="Search suppliers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, maxWidth: { sm: 380 } }}
        />
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
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Add supplier
        </Button>
      </Stack>

      <AppDataGrid rows={suppliers} columns={columns} loading={isLoading} pageSizeOptions={[25, 50]} />

      <SupplierForm open={dialogOpen} onClose={() => setDialogOpen(false)} existing={editing} />

      <DeactivateConfirmModal
        open={!!deactivateTarget}
        title="Deactivate supplier?"
        displayName={deactivateTarget?.name ?? ''}
        subtitle={deactivateTarget?.contact_person}
        warning="The supplier will be hidden from purchase orders and receiving. Open purchase orders that require this supplier cannot be deleted until resolved."
        isPending={deactivate.isPending}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (!deactivateTarget) return
          deactivate.mutate(deactivateTarget.id, {
            onSuccess: () => setDeactivateTarget(null),
          })
        }}
      />
    </Box>
  )
}

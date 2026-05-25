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
import { useManufacturersList } from '@/hooks/manufacturers/useManufacturers'
import { useDeactivateManufacturer } from '@/hooks/manufacturers/useManufacturerMutations'
import { usePermissions } from '@/hooks/auth/usePermissions'
import { ManufacturerForm } from '@/components/organisms/ManufacturerForm/ManufacturerForm'
import { DeactivateConfirmModal } from '@/components/molecules/DeactivateConfirmModal/DeactivateConfirmModal'
import { SearchTextField } from '@/components/molecules/SearchTextField'
import { formatDate } from '@/lib/formatters'
import type { Manufacturer } from '@/types/database.types'
import type { ManufacturerWithCountry } from '@/services/manufacturerService'

export function ManufacturerTable() {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Manufacturer | undefined>()
  const [deactivateTarget, setDeactivateTarget] = useState<ManufacturerWithCountry | null>(
    null,
  )

  const { canDeactivateCatalog } = usePermissions()
  const { data: manufacturers = [], isLoading } = useManufacturersList({
    search,
    showInactive,
  })
  const deactivate = useDeactivateManufacturer()

  const columns: GridColDef<ManufacturerWithCountry>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1.5,
        minWidth: 180,
        renderCell: ({ row }: GridRenderCellParams<ManufacturerWithCountry>) => (
          <Typography variant="body2" fontWeight={600}>
            {row.name}
          </Typography>
        ),
      },
      {
        field: 'countries',
        headerName: 'Country',
        flex: 1,
        minWidth: 120,
        valueGetter: (_v, row) => row.countries?.name ?? '',
        renderCell: ({ row }: GridRenderCellParams<ManufacturerWithCountry>) => (
          <Typography
            variant="body2"
            color={row.countries?.name ? 'text.primary' : 'text.disabled'}
          >
            {row.countries?.name ?? '—'}
          </Typography>
        ),
      },
      {
        field: 'website',
        headerName: 'Website',
        flex: 1,
        minWidth: 140,
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
        renderCell: ({ row }: GridRenderCellParams<ManufacturerWithCountry>) => (
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
        renderCell: ({ row }: GridRenderCellParams<ManufacturerWithCountry>) => (
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
          placeholder="Search manufacturers…"
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
          Add manufacturer
        </Button>
      </Stack>

      <AppDataGrid
        rows={manufacturers}
        columns={columns}
        loading={isLoading}
        pageSizeOptions={[25, 50]}
      />

      <ManufacturerForm
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        existing={editing}
      />

      <DeactivateConfirmModal
        open={!!deactivateTarget}
        title="Deactivate manufacturer?"
        displayName={deactivateTarget?.name ?? ''}
        subtitle={deactivateTarget?.countries?.name}
        warning="The manufacturer will be hidden from product forms. Existing product links remain until updated."
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

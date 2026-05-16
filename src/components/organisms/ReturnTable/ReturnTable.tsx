import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Chip, FormControl, IconButton, InputAdornment,
  InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import SearchIcon   from '@mui/icons-material/Search'
import AddIcon      from '@mui/icons-material/Add'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { useReturns }               from '@/hooks/returns/useReturns'
import { formatDateTime, formatUGX } from '@/lib/formatters'
import type { ReturnWithDetails }   from '@/services/returnService'
import type { ReturnStatus, ReturnType } from '@/types/database.types'

const STATUS_CONFIG: Record<ReturnStatus, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  pending:   { label: 'Pending',   color: 'warning' },
  approved:  { label: 'Approved',  color: 'info' },
  completed: { label: 'Completed', color: 'success' },
  rejected:  { label: 'Rejected',  color: 'error' },
}

const TYPE_CONFIG: Record<ReturnType, { label: string; color: 'default' | 'primary' | 'secondary' }> = {
  restock:  { label: 'Restock',   color: 'primary' },
  writeoff: { label: 'Write-off', color: 'secondary' },
}

interface Props {
  onNewReturn: () => void
}

export function ReturnTable({ onNewReturn }: Props) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ReturnStatus | ''>('')

  const { data: returns = [], isLoading } = useReturns({ search, status: status || undefined })

  const columns: GridColDef<ReturnWithDetails>[] = useMemo(() => [
    {
      field: 'return_number',
      headerName: 'Return #',
      width: 160,
      renderCell: ({ row }: GridRenderCellParams<ReturnWithDetails>) => (
        <Box py={0.5}>
          <Typography variant="body2" fontWeight={700} fontFamily="monospace">
            {row.return_number}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Sale: {row.sales?.sale_number ?? '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'customer',
      headerName: 'Customer',
      flex: 1,
      minWidth: 140,
      renderCell: ({ row }: GridRenderCellParams<ReturnWithDetails>) => (
        <Typography variant="body2">
          {row.customers?.full_name ?? '—'}
        </Typography>
      ),
    },
    {
      field: 'return_type',
      headerName: 'Type',
      width: 110,
      renderCell: ({ value }: GridRenderCellParams) => {
        const cfg = TYPE_CONFIG[value as ReturnType] ?? { label: value, color: 'default' }
        return (
          <Chip
            label={cfg.label}
            size="small"
            color={cfg.color}
            variant="outlined"
            sx={{ borderRadius: '6px', fontSize: '0.7rem' }}
          />
        )
      },
    },
    {
      field: 'total_refund',
      headerName: 'Refund',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: ({ value }: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600} fontFamily="monospace">
          {formatUGX(value as number)}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: ({ value }: GridRenderCellParams) => {
        const cfg = STATUS_CONFIG[value as ReturnStatus] ?? { label: value, color: 'default' }
        return (
          <Chip
            label={cfg.label}
            size="small"
            color={cfg.color}
            variant="filled"
            sx={{ borderRadius: '6px', fontSize: '0.7rem' }}
          />
        )
      },
    },
    {
      field: 'created_at',
      headerName: 'Date',
      width: 150,
      valueFormatter: (v: string) => formatDateTime(v),
    },
    {
      field: 'actions',
      headerName: '',
      width: 56,
      sortable: false,
      renderCell: ({ row }: GridRenderCellParams<ReturnWithDetails>) => (
        <Tooltip title="View details" arrow>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); navigate(`/returns/${row.id}`) }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [navigate])

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2} alignItems="flex-start">
        <TextField
          placeholder="Search by return #, sale #, or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1, maxWidth: { sm: 360 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReturnStatus | '')}
            label="Status"
          >
            <MenuItem value="">All statuses</MenuItem>
            {(Object.entries(STATUS_CONFIG) as [ReturnStatus, { label: string }][]).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={onNewReturn}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          New return
        </Button>
      </Stack>

      <DataGrid
        rows={returns}
        columns={columns}
        loading={isLoading}
        autoHeight
        density="comfortable"
        disableRowSelectionOnClick
        onRowClick={({ row }) => navigate(`/returns/${row.id}`)}
        pageSizeOptions={[25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-cell': { alignItems: 'center' },
        }}
      />
    </Box>
  )
}

import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Button, Chip, Typography, Stack, Paper,
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Divider,
} from '@mui/material'
import ArrowBackIcon   from '@mui/icons-material/ArrowBack'
import SendIcon        from '@mui/icons-material/Send'
import CancelIcon      from '@mui/icons-material/Cancel'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'

import { usePurchaseOrder, useUpdatePOStatus } from '@/hooks/inventory/usePurchaseOrders'
import { formatDate, formatUGX }               from '@/lib/formatters'
import { generatePOPdf }                       from '@/lib/reports/purchaseOrderPdf'
import type { POStatus }                       from '@/types/database.types'

const STATUS_CONFIG: Record<POStatus, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  draft:              { label: 'Draft',              color: 'default' },
  sent:               { label: 'Sent',              color: 'info'    },
  partially_received: { label: 'Partially Received', color: 'warning' },
  received:           { label: 'Fully Received',    color: 'success' },
  cancelled:          { label: 'Cancelled',         color: 'error'   },
}

export function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: po, isLoading } = usePurchaseOrder(id)
  const updateStatus = useUpdatePOStatus()

  if (isLoading || !po) {
    return <Typography color="text.secondary">Loading…</Typography>
  }

  const items = po.purchase_order_items ?? []
  const cfg   = STATUS_CONFIG[po.status]

  const handleSend = () => {
    if (!id) return
    updateStatus.mutate({ id, status: 'sent' })
  }

  const handleCancel = () => {
    if (!id) return
    updateStatus.mutate({ id, status: 'cancelled' })
  }

  const handleDownloadPdf = () => {
    generatePOPdf(po)
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => navigate('/inventory/purchase-orders')}>
          <ArrowBackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            {po.po_number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ordered {formatDate(po.order_date)} by {po.created_by_profile?.full_name}
          </Typography>
        </Box>
        <Chip label={cfg.label} color={cfg.color} sx={{ fontWeight: 600 }} />
      </Stack>

      {/* Meta info */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} divider={<Divider orientation="vertical" flexItem />}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">Supplier</Typography>
            <Typography variant="body2" fontWeight={600}>{po.suppliers?.name ?? '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">Expected Delivery</Typography>
            <Typography variant="body2" fontWeight={600}>
              {po.expected_delivery_date ? formatDate(po.expected_delivery_date) : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">Subtotal</Typography>
            <Typography variant="body2" fontWeight={700} fontFamily="monospace">
              {formatUGX(po.subtotal)}
            </Typography>
          </Box>
          {po.notes && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Notes</Typography>
              <Typography variant="body2">{po.notes}</Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Actions */}
      <Stack direction="row" spacing={1.5} mb={3} flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          startIcon={<PictureAsPdfIcon />}
          onClick={handleDownloadPdf}
        >
          Download PDF
        </Button>
        {po.status === 'draft' && (
          <Button
            variant="contained"
            size="small"
            startIcon={<SendIcon />}
            onClick={handleSend}
            disabled={updateStatus.isPending}
          >
            Mark as Sent
          </Button>
        )}
        {(po.status === 'draft' || po.status === 'sent') && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<CancelIcon />}
            onClick={handleCancel}
            disabled={updateStatus.isPending}
          >
            Cancel PO
          </Button>
        )}
      </Stack>

      {/* Items table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Ordered</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Received</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Cost/Unit</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Line Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{item.products?.name ?? '—'}</Typography>
                  {item.products?.generic_name && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {item.products.generic_name}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{item.product_units?.unit_name ?? '—'}</TableCell>
                <TableCell align="right">{item.quantity_ordered}</TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    color={item.quantity_received >= item.quantity_ordered ? 'success.main' : 'text.primary'}
                  >
                    {item.quantity_received}
                  </Typography>
                </TableCell>
                <TableCell align="right">{formatUGX(item.cost_price_per_unit)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {formatUGX(item.line_total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

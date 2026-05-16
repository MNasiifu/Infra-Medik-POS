import {
  Box, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Typography,
} from '@mui/material'
import PrintIcon    from '@mui/icons-material/Print'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

import { formatUGX } from '@/lib/formatters'
import { receiptToHtml }                  from '@/lib/receipt'
import { printReceiptHtml }               from '@/lib/thermal-print'
import { notify }                         from '@/store/notificationStore'
import type { ReceiptData }               from '@/lib/receipt'

interface Props {
  open:    boolean
  receipt: ReceiptData | null
  onClose: () => void
  onNewSale: () => void
}

export function ReceiptDialog({ open, receipt, onClose, onNewSale }: Props) {
  if (!receipt) return null

  const handlePrint = async () => {
    try {
      await printReceiptHtml(receiptToHtml(receipt))
    } catch (e) {
      notify.error('Print failed — please try again')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <CheckCircleIcon color="success" />
          <Typography variant="h6" fontWeight={700}>Sale Complete</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
          {receipt.saleNumber} · {receipt.dateTime}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Inline receipt preview */}
        <Box
          sx={{
            fontFamily: "'Courier New', monospace",
            fontSize: '11px',
            bgcolor: '#fff',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 1.5,
            mt: 1,
          }}
        >
          <Typography align="center" fontWeight={700} fontSize="13px" fontFamily="inherit" mb={0.5}>
            {receipt.shopName}
          </Typography>
          <Typography align="center" fontSize="10px" fontFamily="inherit" color="text.secondary">
            {receipt.shopAddress.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
            TIN: {receipt.tin}
          </Typography>

          <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

          {receipt.customerName && (
            <Box display="flex" justifyContent="space-between">
              <Typography fontSize="inherit" fontFamily="inherit">Customer</Typography>
              <Typography fontSize="inherit" fontFamily="inherit">{receipt.customerName}</Typography>
            </Box>
          )}
          <Box display="flex" justifyContent="space-between">
            <Typography fontSize="inherit" fontFamily="inherit">Teller</Typography>
            <Typography fontSize="inherit" fontFamily="inherit">{receipt.tellerName}</Typography>
          </Box>

          <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

          {receipt.lines.map((l, i) => (
            <Box key={i} display="flex" justifyContent="space-between" mb={0.25}>
              <Box>
                <Typography fontSize="inherit" fontFamily="inherit" fontWeight={600} lineHeight={1.3}>
                  {l.name}
                </Typography>
                <Typography fontSize="10px" fontFamily="inherit" color="text.secondary">
                  {l.qty} × {l.unitName} @ {formatUGX(l.unitPrice)}
                </Typography>
              </Box>
              <Typography fontSize="inherit" fontFamily="inherit" fontWeight={600} ml={1} whiteSpace="nowrap">
                {formatUGX(l.lineTotal)}
              </Typography>
            </Box>
          ))}

          <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

          <Box display="flex" justifyContent="space-between">
            <Typography fontSize="inherit" fontFamily="inherit" color="text.secondary">Excl. VAT</Typography>
            <Typography fontSize="inherit" fontFamily="inherit">{formatUGX(receipt.subtotalBeforeVat)}</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography fontSize="inherit" fontFamily="inherit" color="text.secondary">VAT (18%)</Typography>
            <Typography fontSize="inherit" fontFamily="inherit">{formatUGX(receipt.totalVat)}</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" mt={0.5}>
            <Typography fontSize="13px" fontFamily="inherit" fontWeight={700}>TOTAL</Typography>
            <Typography fontSize="13px" fontFamily="inherit" fontWeight={700} color="primary.main">
              {formatUGX(receipt.grandTotal)}
            </Typography>
          </Box>

          <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

          {receipt.payments.map((p, i) => (
            <Box key={i} display="flex" justifyContent="space-between">
              <Typography fontSize="inherit" fontFamily="inherit">{p.label}</Typography>
              <Typography fontSize="inherit" fontFamily="inherit">{formatUGX(p.amount)}</Typography>
            </Box>
          ))}
          {receipt.change > 0 && (
            <Box display="flex" justifyContent="space-between">
              <Typography fontSize="inherit" fontFamily="inherit">Change</Typography>
              <Typography fontSize="inherit" fontFamily="inherit" fontWeight={700}>
                {formatUGX(receipt.change)}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
          <Typography align="center" fontSize="10px" fontFamily="inherit" color="text.secondary">
            Thank you for shopping at INFRA MEDIK
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          sx={{ flex: 1 }}
        >
          Print
        </Button>
        <Button
          variant="contained"
          onClick={onNewSale}
          sx={{ flex: 1 }}
        >
          New sale
        </Button>
      </DialogActions>
    </Dialog>
  )
}

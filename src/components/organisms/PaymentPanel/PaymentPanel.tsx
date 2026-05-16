import { useState } from 'react'
import {
  Box, Button, Divider, IconButton, InputAdornment,
  Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip,
  Typography,
} from '@mui/material'
import AddIcon    from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid'
import LocalAtmIcon     from '@mui/icons-material/LocalAtm'
import CellTowerIcon    from '@mui/icons-material/CellTower'

import { formatUGX } from '@/lib/formatters'
import type { PaymentEntry } from '@/hooks/pos/useCompleteSale'
import type { PaymentMethod } from '@/types/database.types'

interface Props {
  grandTotal:   number
  onConfirm:    (payments: PaymentEntry[]) => void
  isSubmitting: boolean
  disabled?:    boolean
}

const METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: React.ReactNode; color: string }> = {
  cash:         { label: 'Cash',         icon: <LocalAtmIcon />,     color: '#2E7D32' },
  mtn_momo:     { label: 'MTN MoMo',    icon: <PhoneAndroidIcon />, color: '#F57F17' },
  airtel_money: { label: 'Airtel Money', icon: <CellTowerIcon />,   color: '#C62828' },
}

interface PaymentLine {
  id:       string
  method:   PaymentMethod
  amount:   string
  reference: string
}

function newPaymentLine(method: PaymentMethod, amount = ''): PaymentLine {
  return { id: Math.random().toString(36).slice(2), method, amount, reference: '' }
}

export function PaymentPanel({ grandTotal, onConfirm, isSubmitting, disabled = false }: Props) {
  const [lines, setLines] = useState<PaymentLine[]>([
    newPaymentLine('cash', String(grandTotal)),
  ])

  const totalEntered = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const remaining    = grandTotal - totalEntered
  const change       = Math.max(0, totalEntered - grandTotal)
  const isValid      = totalEntered >= grandTotal && lines.every((l) => parseFloat(l.amount) > 0)

  const updateLine = (id: string, patch: Partial<PaymentLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id))

  const addLine = () =>
    setLines((prev) => [...prev, newPaymentLine('cash')])

  const handleConfirm = () => {
    if (!isValid) return
    const payments: PaymentEntry[] = lines.map((l) => ({
      method:           l.method,
      amount:           parseFloat(l.amount) || 0,
      reference_number: l.reference.trim() || null,
    }))
    onConfirm(payments)
  }

  return (
    <Stack spacing={2} height="100%" justifyContent="space-between">
      <Box>
        <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
          Payment method{lines.length > 1 ? 's' : ''}
        </Typography>

        <Stack spacing={1.5}>
          {lines.map((line) => (
            <Box key={line.id}>
              {/* Method selector */}
              <ToggleButtonGroup
                exclusive
                size="small"
                value={line.method}
                onChange={(_, v) => v && updateLine(line.id, { method: v })}
                fullWidth
                disabled={disabled || isSubmitting}
                sx={{ mb: 1 }}
              >
                {(Object.entries(METHOD_CONFIG) as [PaymentMethod, typeof METHOD_CONFIG[PaymentMethod]][]).map(
                  ([key, cfg]) => (
                    <ToggleButton
                      key={key}
                      value={key}
                      sx={{
                        flex: 1,
                        fontSize: '0.7rem',
                        gap: 0.5,
                        '&.Mui-selected': {
                          bgcolor: cfg.color + '18',
                          color: cfg.color,
                          borderColor: cfg.color + '80',
                        },
                      }}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </ToggleButton>
                  )
                )}
              </ToggleButtonGroup>

              <Stack direction="row" spacing={1}>
                <TextField
                  label="Amount (UGX)"
                  type="number"
                  size="small"
                  value={line.amount}
                  onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                  disabled={disabled || isSubmitting}
                  inputProps={{ min: 0, step: 500 }}
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="caption" color="text.secondary">UGX</Typography>
                      </InputAdornment>
                    ),
                  }}
                />

                {line.method !== 'cash' && (
                  <TextField
                    label="Reference / phone"
                    size="small"
                    value={line.reference}
                    onChange={(e) => updateLine(line.id, { reference: e.target.value })}
                    disabled={disabled || isSubmitting}
                    sx={{ flex: 1 }}
                    placeholder="0771234567"
                  />
                )}

                {lines.length > 1 && (
                  <Tooltip title="Remove" arrow>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeLine(line.id)}
                      disabled={isSubmitting}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>

        {lines.length < 3 && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={addLine}
            disabled={disabled || isSubmitting}
            sx={{ mt: 1 }}
          >
            Add payment method (split)
          </Button>
        )}
      </Box>

      {/* Summary */}
      <Box>
        <Divider sx={{ mb: 1.5 }} />
        <Stack spacing={0.5}>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Grand total</Typography>
            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
              {formatUGX(grandTotal)}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Tendered</Typography>
            <Typography
              variant="body2"
              fontFamily="monospace"
              color={totalEntered >= grandTotal ? 'success.main' : 'text.primary'}
              fontWeight={600}
            >
              {formatUGX(totalEntered)}
            </Typography>
          </Box>
          {remaining > 0 && (
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="error.main">Remaining</Typography>
              <Typography variant="body2" fontFamily="monospace" color="error.main" fontWeight={600}>
                {formatUGX(remaining)}
              </Typography>
            </Box>
          )}
          {change > 0 && (
            <Box display="flex" justifyContent="space-between" bgcolor="success.light" px={1} py={0.5} borderRadius={1}>
              <Typography variant="subtitle2" color="success.dark">Change</Typography>
              <Typography variant="subtitle2" fontFamily="monospace" color="success.dark" fontWeight={700}>
                {formatUGX(change)}
              </Typography>
            </Box>
          )}
        </Stack>

        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!isValid || isSubmitting || disabled}
          onClick={handleConfirm}
          sx={{ mt: 2, py: 1.5, fontSize: '1rem', fontWeight: 700 }}
        >
          {isSubmitting ? 'Processing…' : `Confirm Sale · ${formatUGX(grandTotal)}`}
        </Button>
      </Box>
    </Stack>
  )
}

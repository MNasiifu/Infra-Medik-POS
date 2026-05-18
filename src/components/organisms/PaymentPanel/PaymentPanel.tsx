import { useState } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import LocalAtmIcon from "@mui/icons-material/LocalAtm";
import CellTowerIcon from "@mui/icons-material/CellTower";

import { formatUGX } from "@/lib/formatters";
import type { PaymentEntry } from "@/hooks/pos/useCompleteSale";
import type { PaymentMethod } from "@/types/database.types";

interface Props {
  grandTotal: number;
  onConfirm: (payments: PaymentEntry[]) => void;
  isSubmitting: boolean;
  disabled?: boolean;
}

const METHOD_CONFIG: Record<
  PaymentMethod,
  { label: string; icon: React.ReactNode; color: string }
> = {
  cash: { label: "Cash", icon: <LocalAtmIcon />, color: "#2E7D32" },
  mtn_momo: { label: "MTN MoMo", icon: <PhoneAndroidIcon />, color: "#F57F17" },
  airtel_money: {
    label: "Airtel Money",
    icon: <CellTowerIcon />,
    color: "#C62828",
  },
};

interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
}

function newPaymentLine(method: PaymentMethod, amount = ""): PaymentLine {
  return {
    id: Math.random().toString(36).slice(2),
    method,
    amount,
    reference: "",
  };
}

export function PaymentPanel({
  grandTotal,
  onConfirm,
  isSubmitting,
  disabled = false,
}: Props) {
  const [primaryMethod, setPrimaryMethod] = useState<PaymentMethod>("cash");
  const [primaryAmount, setPrimaryAmount] = useState<string>(
    String(grandTotal),
  );
  const [primaryReference, setPrimaryReference] = useState<string>("");
  const [splitLines, setSplitLines] = useState<PaymentLine[]>([]);

  // Calculate primary payment amount
  const primaryAmountValue = parseFloat(primaryAmount) || 0;

  // Calculate change only for cash
  const change =
    primaryMethod === "cash" ? Math.max(0, primaryAmountValue - grandTotal) : 0;

  // Total from split payments
  const splitPaymentTotal = splitLines.reduce(
    (s, l) => s + (parseFloat(l.amount) || 0),
    0,
  );

  // Validation
  const isPrimaryValid =
    primaryAmountValue > 0 &&
    (primaryMethod === "cash" ||
      (primaryReference.trim().length > 0 && primaryAmountValue > 0));

  const areSplitsValid = splitLines.every(
    (l) =>
      parseFloat(l.amount) > 0 &&
      (l.method === "cash" || l.reference.trim().length > 0),
  );

  const isValid = isPrimaryValid && areSplitsValid;

  const updateSplitLine = (id: string, patch: Partial<PaymentLine>) =>
    setSplitLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );

  const removeSplitLine = (id: string) =>
    setSplitLines((prev) => prev.filter((l) => l.id !== id));

  const addSplitLine = () =>
    setSplitLines((prev) => [...prev, newPaymentLine("mtn_momo")]);

  const handleConfirm = () => {
    if (!isValid) return;
    const payments: PaymentEntry[] = [
      {
        method: primaryMethod,
        amount: primaryAmountValue,
        reference_number:
          primaryMethod === "cash" ? null : primaryReference.trim() || null,
      },
      ...splitLines.map((l) => ({
        method: l.method,
        amount: parseFloat(l.amount) || 0,
        reference_number:
          l.method === "cash" ? null : l.reference.trim() || null,
      })),
    ];
    onConfirm(payments);
  };

  return (
    <Stack spacing={2} height="100%" justifyContent="space-between">
      <Box>
        {/* Grand Total Display */}
        <Box mb={2}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            AMOUNT DUE
          </Typography>
          <Typography
            variant="h5"
            fontWeight={700}
            color="primary.main"
            sx={{ fontFamily: "monospace" }}
          >
            {formatUGX(grandTotal)}
          </Typography>
        </Box>

        {/* Primary Payment Method Tabs */}
        <Typography variant="subtitle2" fontWeight={600} mb={1}>
          Primary Payment Method
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={primaryMethod}
          onChange={(_, v) => v && setPrimaryMethod(v)}
          fullWidth
          disabled={disabled || isSubmitting}
          sx={{ mb: 2 }}
        >
          {(
            Object.entries(METHOD_CONFIG) as [
              PaymentMethod,
              (typeof METHOD_CONFIG)[PaymentMethod],
            ][]
          ).map(([key, cfg]) => (
            <ToggleButton
              key={key}
              value={key}
              sx={{
                flex: 1,
                fontSize: "0.85rem",
                gap: 0.5,
                py: 1.5,
                "&.Mui-selected": {
                  bgcolor: cfg.color + "18",
                  color: cfg.color,
                  borderColor: cfg.color + "80",
                  fontWeight: 700,
                },
              }}
            >
              {cfg.icon}
              {cfg.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* Primary Payment Input - CASH */}
        {primaryMethod === "cash" && (
          <>
            <TextField
              label="Cash Received (UGX)"
              type="number"
              fullWidth
              size="medium"
              value={primaryAmount}
              onChange={(e) => setPrimaryAmount(e.target.value)}
              disabled={disabled || isSubmitting}
              inputProps={{ min: 0, step: 500 }}
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  fontSize: "1.1rem",
                  fontFamily: "monospace",
                  fontWeight: 700,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocalAtmIcon sx={{ color: "#2E7D32", mr: 0.5 }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Change Display Section */}
            <Box
              sx={{
                bgcolor: "rgba(46, 125, 50, 0.08)",
                border: "2px solid rgba(46, 125, 50, 0.4)",
                borderRadius: 1,
                p: 1.5,
                mb: 2,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={600}
                display="block"
                mb={0.5}
              >
                CHANGE DUE
              </Typography>
              <Typography
                variant="h6"
                fontWeight={700}
                color="#2E7D32"
                sx={{ fontFamily: "monospace", fontSize: "1.5rem" }}
              >
                {formatUGX(change)}
              </Typography>
            </Box>
          </>
        )}

        {/* Primary Payment Input - MTN/AIRTEL */}
        {(primaryMethod === "mtn_momo" || primaryMethod === "airtel_money") && (
          <>
            <Stack direction="row" spacing={1} mb={2}>
              <TextField
                label="Amount (UGX)"
                type="number"
                size="medium"
                value={primaryAmount}
                onChange={(e) => setPrimaryAmount(e.target.value)}
                disabled={disabled || isSubmitting}
                inputProps={{ min: 0, step: 500 }}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography variant="caption" color="text.secondary">
                        UGX
                      </Typography>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Phone / Reference"
                size="medium"
                value={primaryReference}
                onChange={(e) => setPrimaryReference(e.target.value)}
                disabled={disabled || isSubmitting}
                placeholder="0771234567"
                sx={{ flex: 1 }}
              />
            </Stack>
          </>
        )}

        {/* Split Payments Section */}
        {splitLines.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
              Additional payment method{splitLines.length > 1 ? "s" : ""}
            </Typography>

            <Stack spacing={1.5}>
              {splitLines.map((line) => (
                <Box key={line.id}>
                  {/* Method selector */}
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={line.method}
                    onChange={(_, v) =>
                      v && updateSplitLine(line.id, { method: v })
                    }
                    fullWidth
                    disabled={disabled || isSubmitting}
                    sx={{ mb: 1 }}
                  >
                    {(
                      Object.entries(METHOD_CONFIG) as [
                        PaymentMethod,
                        (typeof METHOD_CONFIG)[PaymentMethod],
                      ][]
                    ).map(([key, cfg]) => (
                      <ToggleButton
                        key={key}
                        value={key}
                        sx={{
                          flex: 1,
                          fontSize: "0.7rem",
                          gap: 0.5,
                          "&.Mui-selected": {
                            bgcolor: cfg.color + "18",
                            color: cfg.color,
                            borderColor: cfg.color + "80",
                          },
                        }}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>

                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Amount (UGX)"
                      type="number"
                      size="small"
                      value={line.amount}
                      onChange={(e) =>
                        updateSplitLine(line.id, { amount: e.target.value })
                      }
                      disabled={disabled || isSubmitting}
                      inputProps={{ min: 0, step: 500 }}
                      sx={{ flex: 1 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              UGX
                            </Typography>
                          </InputAdornment>
                        ),
                      }}
                    />

                    {line.method !== "cash" && (
                      <TextField
                        label="Phone / Ref"
                        size="small"
                        value={line.reference}
                        onChange={(e) =>
                          updateSplitLine(line.id, {
                            reference: e.target.value,
                          })
                        }
                        disabled={disabled || isSubmitting}
                        placeholder="0771234567"
                        sx={{ flex: 1 }}
                      />
                    )}

                    <Tooltip title="Remove" arrow>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeSplitLine(line.id)}
                        disabled={isSubmitting}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </>
        )}

        {splitLines.length < 2 && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={addSplitLine}
            disabled={disabled || isSubmitting}
            sx={{ mt: splitLines.length > 0 ? 1 : 2 }}
          >
            Add payment method (split)
          </Button>
        )}
      </Box>

      {/* Summary & Confirm */}
      <Box>
        <Divider sx={{ mb: 1.5 }} />
        <Stack spacing={0.75}>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Amount due
            </Typography>
            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
              {formatUGX(grandTotal)}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {METHOD_CONFIG[primaryMethod].label}
            </Typography>
            <Typography
              variant="body2"
              fontFamily="monospace"
              color={primaryAmountValue > 0 ? "success.main" : "text.primary"}
              fontWeight={600}
            >
              {formatUGX(primaryAmountValue)}
            </Typography>
          </Box>
          {splitPaymentTotal > 0 && (
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Split payments
              </Typography>
              <Typography
                variant="body2"
                fontFamily="monospace"
                fontWeight={600}
              >
                {formatUGX(splitPaymentTotal)}
              </Typography>
            </Box>
          )}
          {change > 0 && (
            <Box
              display="flex"
              justifyContent="space-between"
              bgcolor="rgba(46, 125, 50, 0.1)"
              px={1}
              py={0.75}
              borderRadius={1}
              border="1px solid rgba(46, 125, 50, 0.3)"
            >
              <Typography variant="subtitle2" color="#2E7D32" fontWeight={600}>
                Change
              </Typography>
              <Typography
                variant="subtitle2"
                fontFamily="monospace"
                color="#2E7D32"
                fontWeight={700}
              >
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
          sx={{ mt: 2, py: 1.5, fontSize: "1rem", fontWeight: 700 }}
        >
          {isSubmitting
            ? "Processing…"
            : `Confirm Sale · ${formatUGX(grandTotal)}`}
        </Button>
      </Box>
    </Stack>
  );
}

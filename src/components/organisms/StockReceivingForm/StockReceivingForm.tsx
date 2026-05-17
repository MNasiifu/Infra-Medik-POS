import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Stack,
  Paper,
  TextField,
  Autocomplete,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import { useSuppliers } from "@/hooks/shared/useReferenceData";
import { useProducts } from "@/hooks/products/useProducts";
import {
  usePurchaseOrders,
  usePurchaseOrder,
} from "@/hooks/inventory/usePurchaseOrders";
import { useCompleteStockReceiving } from "@/hooks/inventory/useStockReceivings";
import { useAuthStore } from "@/store/authStore";
import { formatUGX } from "@/lib/formatters";
import type { ProductWithDetails } from "@/services/productService";

interface ReceivingLine {
  _id: string;
  product_id: string;
  product_unit_id: string;
  purchase_order_item_id: string | null;
  batch_number: string;
  stock_in_date: string;
  expiry_date: string | null;
  quantity_received: number;
  cost_price_per_unit: number;
  product_name: string;
  unit_name: string;
}

interface Props {
  onDone?: () => void;
}

export function StockReceivingForm({ onDone }: Props) {
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null);
  const completeReceiving = useCompleteStockReceiving();

  const { data: suppliers = [] } = useSuppliers();
  const { data: products = [] } = useProducts();
  const { data: purchaseOrders = [] } = usePurchaseOrders();

  const [supplierId, setSupplierId] = useState("");
  const [poId, setPoId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReceivingLine[]>([]);

  // Load PO details when selected
  const { data: poDetail } = usePurchaseOrder(poId || undefined);

  // Auto-populate items from PO
  useEffect(() => {
    if (!poDetail) return;
    setSupplierId(poDetail.supplier_id);
    const poItems = poDetail.purchase_order_items ?? [];
    const lines: ReceivingLine[] = poItems
      .filter((pi) => pi.quantity_received < pi.quantity_ordered)
      .map((pi) => ({
        _id: `po-${pi.id}`,
        product_id: pi.product_id,
        product_unit_id: pi.product_unit_id,
        purchase_order_item_id: pi.id,
        batch_number: "",
        stock_in_date: new Date().toISOString().split("T")[0],
        expiry_date: null,
        quantity_received: pi.quantity_ordered - pi.quantity_received,
        cost_price_per_unit: pi.cost_price_per_unit,
        product_name: pi.products?.name ?? "—",
        unit_name: pi.product_units?.unit_name ?? "—",
      }));
    setItems(lines);
  }, [poDetail]);

  // ─── Manual add item ──────────────────────────────────────
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithDetails | null>(null);
  const [unitId, setUnitId] = useState("");
  const [batchNum, setBatchNum] = useState("");
  const [stockInDate, setStockInDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");

  const handleAddItem = () => {
    if (
      !selectedProduct ||
      !unitId ||
      !batchNum ||
      !stockInDate ||
      !qty ||
      !cost
    )
      return;

    // Validation: stock_in_date must be <= expiry_date (if expiry exists)
    if (expiryDate && stockInDate > expiryDate) {
      alert("Stock in date cannot be after expiry date");
      return;
    }

    const unit = (selectedProduct as any).product_units?.find?.(
      (u: any) => u.id === unitId,
    );
    const line: ReceivingLine = {
      _id: `manual-${Date.now()}`,
      product_id: selectedProduct.id,
      product_unit_id: unitId,
      purchase_order_item_id: null,
      batch_number: batchNum,
      stock_in_date: stockInDate,
      expiry_date: expiryDate || null,
      quantity_received: parseFloat(qty),
      cost_price_per_unit: parseFloat(cost),
      product_name: selectedProduct.name,
      unit_name: unit?.unit_name ?? "—",
    };
    setItems((prev) => [...prev, line]);
    setSelectedProduct(null);
    setUnitId("");
    setBatchNum("");
    setStockInDate("");
    setExpiryDate("");
    setQty("");
    setCost("");
  };

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i._id !== id));

  const updateItemField = (
    id: string,
    field: keyof ReceivingLine,
    value: string | number | null,
  ) => {
    setItems((prev) =>
      prev.map((i) => (i._id === id ? { ...i, [field]: value } : i)),
    );
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = () => {
    if (!branchId || items.length === 0) return;

    // Validation: check all required fields and business rules
    const invalidItems = items.some(
      (i) =>
        !i.batch_number ||
        !i.stock_in_date ||
        i.quantity_received <= 0 ||
        (i.expiry_date && i.stock_in_date > i.expiry_date),
    );
    if (invalidItems) {
      alert("Please fix validation errors in all items");
      return;
    }

    completeReceiving.mutate(
      {
        branch_id: branchId,
        supplier_id: supplierId || null,
        purchase_order_id: poId || null,
        notes: notes || null,
        items: items.map(
          ({
            product_id,
            product_unit_id,
            purchase_order_item_id,
            batch_number,
            stock_in_date,
            expiry_date,
            quantity_received,
            cost_price_per_unit,
          }) => ({
            product_id,
            product_unit_id,
            purchase_order_item_id,
            batch_number,
            stock_in_date,
            expiry_date,
            quantity_received,
            cost_price_per_unit,
          }),
        ),
      },
      { onSuccess: () => onDone?.() },
    );
  };

  const openPOs = purchaseOrders.filter(
    (po) => po.status === "sent" || po.status === "partially_received",
  );

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>
          Receive Stock
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Record incoming stock. Link to a purchase order or receive manually.
        </Typography>
      </Box>

      {/* Source selection */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Purchase Order (optional)</InputLabel>
            <Select
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
              label="Purchase Order (optional)"
            >
              <MenuItem value="">Manual receiving (no PO)</MenuItem>
              {openPOs.map((po) => (
                <MenuItem key={po.id} value={po.id}>
                  {po.po_number} — {po.suppliers?.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Supplier</InputLabel>
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              label="Supplier"
            >
              <MenuItem value="">No supplier</MenuItem>
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <TextField
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          size="small"
          fullWidth
          multiline
          rows={2}
          sx={{ mt: 2 }}
        />
      </Paper>

      {/* Manual add item panel */}
      {!poId && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle2" mb={1.5}>
            Add item
          </Typography>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Autocomplete
                options={products}
                getOptionLabel={(p) => p.name}
                value={selectedProduct}
                onChange={(_, p) => {
                  setSelectedProduct(p);
                  setUnitId("");
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Product" size="small" />
                )}
                sx={{ flex: 1 }}
                isOptionEqualToValue={(a, b) => a.id === b.id}
              />
              <TextField
                label="Unit"
                select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                size="small"
                sx={{ minWidth: 110 }}
                disabled={!selectedProduct}
              >
                {((selectedProduct as any)?.product_units ?? []).map(
                  (u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_name}
                    </option>
                  ),
                )}
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Batch #"
                value={batchNum}
                onChange={(e) => setBatchNum(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Stock In Date *"
                type="date"
                value={stockInDate}
                onChange={(e) => setStockInDate(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                size="small"
                sx={{ width: 80 }}
              />
              <TextField
                label="Cost/Unit"
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                size="small"
                sx={{ width: 110 }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddItem}
                disabled={
                  !selectedProduct ||
                  !unitId ||
                  !batchNum ||
                  !stockInDate ||
                  !qty ||
                  !cost
                }
              >
                Add
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Items table (editable for PO lines) */}
      {items.length > 0 && (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ borderRadius: 2, mb: 3 }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Batch #</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stock In Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Expiry</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Qty
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Cost/Unit
                </TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{item.unit_name}</TableCell>
                  <TableCell>
                    <TextField
                      value={item.batch_number}
                      onChange={(e) =>
                        updateItemField(
                          item._id,
                          "batch_number",
                          e.target.value,
                        )
                      }
                      size="small"
                      variant="standard"
                      placeholder="BATCH001"
                      sx={{ width: 110 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="date"
                      value={item.stock_in_date ?? ""}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (item.expiry_date && newValue > item.expiry_date) {
                          alert("Stock in date cannot be after expiry date");
                          return;
                        }
                        updateItemField(item._id, "stock_in_date", newValue);
                      }}
                      size="small"
                      variant="standard"
                      sx={{ width: 130 }}
                      error={
                        item.expiry_date
                          ? item.stock_in_date > item.expiry_date
                          : false
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="date"
                      value={item.expiry_date ?? ""}
                      onChange={(e) => {
                        const newValue = e.target.value || null;
                        if (
                          newValue &&
                          item.stock_in_date &&
                          item.stock_in_date > newValue
                        ) {
                          alert(
                            "Expiry date must be on or after stock in date",
                          );
                          return;
                        }
                        updateItemField(item._id, "expiry_date", newValue);
                      }}
                      size="small"
                      variant="standard"
                      sx={{ width: 130 }}
                      error={
                        item.expiry_date
                          ? item.stock_in_date > item.expiry_date
                          : false
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      type="number"
                      value={item.quantity_received}
                      onChange={(e) =>
                        updateItemField(
                          item._id,
                          "quantity_received",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      size="small"
                      variant="standard"
                      inputProps={{ style: { textAlign: "right" } }}
                      sx={{ width: 70 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontFamily="monospace">
                      {formatUGX(item.cost_price_per_unit)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeItem(item._id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Submit */}
      <Button
        variant="contained"
        size="large"
        onClick={handleSubmit}
        disabled={
          completeReceiving.isPending ||
          items.length === 0 ||
          items.some((i) => !i.batch_number || !i.stock_in_date)
        }
      >
        {completeReceiving.isPending ? "Processing…" : "Complete Receiving"}
      </Button>
    </Box>
  );
}

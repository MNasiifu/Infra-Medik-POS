import { useState, useMemo, useCallback } from "react";
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  InputAdornment,
  Stack,
  Button,
  Typography,
  Select,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { useNavigate } from "react-router-dom";

import { useProductStock } from "@/hooks/inventory/useInventory";
import { useProductBatches } from "@/hooks/inventory/useInventory";
import { useCategories, useSuppliers } from "@/hooks/shared/useReferenceData";
import { formatUGX, formatDate, getDaysUntilExpiry } from "@/lib/formatters";
import type {
  ProductStockAggregate,
  StockBatchWithDetails,
} from "@/services/inventoryService";

function StockStatusChip({ quantity }: { quantity: number }) {
  if (quantity === 0) {
    return <Chip label="Out of Stock" size="small" color="error" />;
  } else if (quantity <= 10) {
    return <Chip label="Low Stock" size="small" color="warning" />;
  }
  return <Chip label="In Stock" size="small" color="success" />;
}

interface BatchViewDialogProps {
  open: boolean;
  productId: string | null;
  onClose: () => void;
}

function BatchViewDialog({ open, productId, onClose }: BatchViewDialogProps) {
  const { data: batches = [], isLoading } = useProductBatches(
    productId ?? undefined,
  );

  const totalQty = useMemo(
    () => batches.reduce((sum, b) => sum + b.quantity_remaining, 0),
    [batches],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6">Product Batches (FEFO Tracked)</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : batches.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={3}>
            No batches available for this product.
          </Typography>
        ) : (
          <Stack spacing={2}>
            <Box
              sx={{
                p: 1.5,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                Total Quantity: {totalQty}
              </Typography>
            </Box>
            {batches.map((batch) => {
              const daysRemaining = batch.expiry_date
                ? getDaysUntilExpiry(batch.expiry_date)
                : null;
              const isExpired = daysRemaining !== null && daysRemaining < 0;
              const isExpiringSoon =
                daysRemaining !== null &&
                daysRemaining >= 0 &&
                daysRemaining <= 30;

              return (
                <Box
                  key={batch.id}
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    bgcolor: isExpired
                      ? "error.50"
                      : isExpiringSoon
                        ? "warning.50"
                        : "background.default",
                  }}
                >
                  <Stack spacing={0.5}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          Batch #
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          fontFamily="monospace"
                        >
                          {batch.batch_number}
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          Quantity Remaining
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          fontFamily="monospace"
                        >
                          {batch.quantity_remaining} (
                          {batch.product_units?.unit_name ?? "Unit"})
                        </Typography>
                      </Box>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Stock In: {formatDate(batch.stock_in_date)}
                        </Typography>
                      </Box>
                      <Box>
                        {batch.expiry_date ? (
                          <Chip
                            label={
                              isExpired
                                ? `Expired (${formatDate(batch.expiry_date)})`
                                : isExpiringSoon
                                  ? `${formatDate(batch.expiry_date)} (${daysRemaining}d)`
                                  : formatDate(batch.expiry_date)
                            }
                            size="small"
                            color={
                              isExpired
                                ? "error"
                                : isExpiringSoon
                                  ? "warning"
                                  : "success"
                            }
                            variant={isExpired ? "filled" : "outlined"}
                            sx={{ fontSize: "0.7rem" }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            No expiry
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    {batch.suppliers && (
                      <Typography variant="caption" color="text.secondary">
                        Supplier: {batch.suppliers.name}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProductStockTable() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [showOutOfStock, setShowOutOfStock] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const navigate = useNavigate();

  const { data: products = [], isLoading } = useProductStock({
    search: search || undefined,
    categoryId: categoryId || undefined,
    supplierId: supplierId || undefined,
    showOutOfStock: showOutOfStock,
    lowStockThreshold:
      typeof lowStockThreshold === "number" && lowStockThreshold > 0
        ? lowStockThreshold
        : undefined,
  });

  const { data: categories = [] } = useCategories();
  const { data: suppliers = [] } = useSuppliers();

  const handleViewBatches = useCallback((productId: string) => {
    setSelectedProductId(productId);
    setBatchDialogOpen(true);
  }, []);

  const handleCloseBatchDialog = useCallback(() => {
    setBatchDialogOpen(false);
    setSelectedProductId(null);
  }, []);

  const handleViewProduct = useCallback(
    (productId: string) => {
      navigate(`/products/${productId}`);
    },
    [navigate],
  );

  const columns: GridColDef<ProductStockAggregate>[] = useMemo(
    () => [
      {
        field: "product_name",
        headerName: "Product Name",
        flex: 1.5,
        minWidth: 220,
        renderCell: ({ row }: GridRenderCellParams<ProductStockAggregate>) => (
          <Box py={0.5}>
            <Typography
              variant="body2"
              fontWeight={600}
              lineHeight={1.3}
              sx={{
                cursor: "pointer",
                color: "primary.main",
                "&:hover": { textDecoration: "underline" },
              }}
              onClick={() => handleViewProduct(row.product_id)}
            >
              {row.product_name}
            </Typography>
            {row.generic_name && (
              <Typography
                variant="caption"
                color="text.secondary"
                lineHeight={1.2}
                display="block"
              >
                {row.generic_name}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: "quantity_remaining",
        headerName: "Qty Remaining",
        width: 140,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<ProductStockAggregate>) => (
          <Typography variant="body2" fontWeight={600} fontFamily="monospace">
            {row.quantity_remaining}
          </Typography>
        ),
      },
      {
        field: "unit_name",
        headerName: "Unit",
        width: 100,
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography variant="body2">{value as string}</Typography>
        ),
      },
      {
        field: "category_name",
        headerName: "Category",
        width: 140,
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography
            variant="body2"
            color={value === null ? "text.disabled" : "text.primary"}
          >
            {(value as string) ?? "—"}
          </Typography>
        ),
      },
      {
        field: "supplier_name",
        headerName: "Supplier",
        width: 140,
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography
            variant="body2"
            color={value === null ? "text.disabled" : "text.primary"}
          >
            {(value as string) ?? "—"}
          </Typography>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        sortable: false,
        renderCell: ({ row }: GridRenderCellParams<ProductStockAggregate>) => (
          <StockStatusChip quantity={row.quantity_remaining} />
        ),
      },
      {
        field: "actions",
        headerName: "",
        width: 120,
        sortable: false,
        filterable: false,
        align: "center",
        renderCell: ({ row }: GridRenderCellParams<ProductStockAggregate>) => (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="View batches" arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewBatches(row.product_id);
                }}
                color="info"
              >
                <LocalOfferIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="View product" arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewProduct(row.product_id);
                }}
              >
                <InventoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [handleViewBatches, handleViewProduct],
  );

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>
          Product Stock Summary
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View all products with aggregated stock quantities across batches.
        </Typography>
      </Box>

      {/* Toolbar */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        mb={2}
        alignItems="flex-start"
      >
        <TextField
          placeholder="Search by product name or generic name…"
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
          variant={showFilters ? "contained" : "outlined"}
          size="small"
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters((v) => !v)}
          sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          Filters
        </Button>
      </Stack>

      {/* Filter panel */}
      {showFilters && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          mb={2}
          flexWrap="wrap"
        >
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              label="Category"
            >
              <MenuItem value="">All Categories</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Supplier</InputLabel>
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              label="Supplier"
            >
              <MenuItem value="">All Suppliers</MenuItem>
              {suppliers.map((supp) => (
                <MenuItem key={supp.id} value={supp.id}>
                  {supp.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Low Stock Threshold"
            type="number"
            value={lowStockThreshold}
            onChange={(e) =>
              setLowStockThreshold(
                e.target.value === "" ? "" : parseInt(e.target.value, 10),
              )
            }
            size="small"
            placeholder="e.g., 10"
            sx={{ minWidth: 140 }}
            helperText="Leave empty to disable"
          />

          <FormControlLabel
            control={
              <Switch
                checked={showOutOfStock}
                onChange={(e) => setShowOutOfStock(e.target.checked)}
              />
            }
            label="Show Out of Stock"
          />
        </Stack>
      )}

      {/* DataGrid with virtual scrolling */}
      <Box
        sx={{
          height: "calc(100vh - 400px)",
          minHeight: 400,
          bgcolor: "background.paper",
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <DataGrid
          rows={products}
          columns={columns}
          getRowId={(row) => row.product_id}
          loading={isLoading}
          disableSelectionOnClick
          density="comfortable"
          sx={{
            "& .MuiDataGrid-cell": { py: 1 },
            "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
          }}
          columnHeaderHeight={44}
          virtualization={{}}
        />
      </Box>

      {/* Batch View Dialog */}
      <BatchViewDialog
        open={batchDialogOpen}
        productId={selectedProductId}
        onClose={handleCloseBatchDialog}
      />
    </Box>
  );
}

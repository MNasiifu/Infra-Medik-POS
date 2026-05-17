import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AddIcon from "@mui/icons-material/Add";
import FilterListIcon from "@mui/icons-material/FilterList";

import { useProducts, useDeleteProduct } from "@/hooks/products/useProducts";
import { useToggleProductActive } from "@/hooks/products/useProductMutations";
import { useCategories } from "@/hooks/shared/useReferenceData";
import { formatUGX } from "@/lib/formatters";
import type { ProductWithDetails } from "@/services/productService";
import type { DosageForm } from "@/types/database.types";
import {DeleteProductModal} from "./DeleteProductModal";
import { ToggleProductModal } from "./ToggleProductModal";

const DOSAGE_COLORS: Record<DosageForm, string> = {
  tablet: "#1565C0",
  capsule: "#6A1B9A",
  syrup: "#00838F",
  suspension: "#0277BD",
  cream: "#2E7D32",
  ointment: "#558B2F",
  gel: "#00695C",
  injection: "#C62828",
  drops: "#F57F17",
  powder: "#4E342E",
  inhaler: "#283593",
  patch: "#4527A0",
  suppository: "#37474F",
  other: "#546E7A",
};

// ─── Modal state shape ───────────────────────────────────────────
// Keeps all confirmation state in one place so it's easy to reason
// about what is open and which product is targeted.
type ModalState =
  | { kind: "none" }
  | { kind: "delete"; product: ProductWithDetails }
  | { kind: "toggle"; product: ProductWithDetails };

// ─── Per-row three-dot action menu ──────────────────────────────
interface RowActionsMenuProps {
  row: ProductWithDetails;
  onViewDetails: (row: ProductWithDetails) => void;
  onEdit: (row: ProductWithDetails) => void;
  onToggleActive: (row: ProductWithDetails) => void;
  onDelete: (row: ProductWithDetails) => void;
}

function RowActionsMenu({
  row,
  onViewDetails,
  onEdit,
  onToggleActive,
  onDelete,
}: RowActionsMenuProps) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
  };

  const handleClose = (e?: React.MouseEvent | {}) => {
    if (e && "stopPropagation" in (e as React.MouseEvent)) {
      (e as React.MouseEvent).stopPropagation();
    }
    setOpen(false);
  };

  const handle =
    (action: (r: ProductWithDetails) => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      action(row);
    };

  return (
    <>
      <Tooltip title="More actions" arrow>
        <IconButton
          ref={anchorRef}
          size="small"
          onClick={handleOpen}
          aria-label={`actions for ${row.name}`}
          aria-haspopup="true"
          aria-expanded={open}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorRef.current}
        open={open}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            elevation: 3,
            sx: {
              minWidth: 172,
              borderRadius: 2,
              mt: 0.5,
              "& .MuiMenuItem-root": {
                borderRadius: 1,
                mx: 0.5,
                my: 0.25,
                px: 1.5,
                py: 0.75,
                fontSize: "0.875rem",
              },
            },
          },
        }}
      >
        {/* ── View Details ─────────────────────── */}
        <MenuItem onClick={handle(onViewDetails)}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <VisibilityIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary="View Details" />
        </MenuItem>

        {/* ── Edit ─────────────────────────────── */}
        <MenuItem onClick={handle(onEdit)}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <EditIcon fontSize="small" color="action" />
          </ListItemIcon>
          <ListItemText primary="Edit" />
        </MenuItem>

        {/* ── Activate / Deactivate ─────────────────────── */}
        <MenuItem onClick={handle(onToggleActive)}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            {row.is_active ? (
              <ToggleOffIcon fontSize="small" color="warning" />
            ) : (
              <ToggleOnIcon fontSize="small" color="success" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={row.is_active ? "Deactivate" : "Activate"}
            slotProps={{
              primary: {
                sx: {
                  color: row.is_active ? "warning.main" : "success.main",
                  fontWeight: 500,
                },
              },
            }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* ── Delete ──────────────────────────── */}
        <MenuItem onClick={handle(onDelete)}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText
            primary="Delete"
            slotProps={{
              primary: { sx: { color: "error.main", fontWeight: 500 } },
            }}
          />
        </MenuItem>
      </Menu>
    </>
  );
}

// ─── Main table component ────────────────────────────────────────
export function ProductTable() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ── Single piece of modal state ──────────────────────────────
  // Using a discriminated union keeps "which modal" and "which product"
  // always in sync — no risk of modal open + product null mismatches.
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const { data: products = [], isLoading } = useProducts({
    search: search || undefined,
    categoryId: categoryId || undefined,
    dosageForm: dosageForm || undefined,
    showInactive: showInactive || undefined,
  });
  const { data: categories = [] } = useCategories();
  const toggleActive = useToggleProductActive();
  const deleteProduct = useDeleteProduct();

  // ── Modal open handlers (no mutation fired here) ─────────────
  const handleViewDetails = useCallback(
    (row: ProductWithDetails) => navigate(`/products/${row.id}`),
    [navigate],
  );

  const handleEdit = useCallback(
    (row: ProductWithDetails) => navigate(`/products/${row.id}/edit`),
    [navigate],
  );

  const handleRequestToggle = useCallback(
    (row: ProductWithDetails) => setModal({ kind: "toggle", product: row }),
    [],
  );

  const handleRequestDelete = useCallback(
    (row: ProductWithDetails) => setModal({ kind: "delete", product: row }),
    [],
  );

  // ── Close — only allowed when no mutation is in flight ───────
  const handleClose = useCallback(() => {
    // Guard: don't allow dismissal while a mutation is pending.
    // The Dialog itself also blocks backdrop-click in this state,
    // but this covers the Cancel button path too.
    if (toggleActive.isPending || deleteProduct.isPending) return;
    setModal({ kind: "none" });
  }, [toggleActive.isPending, deleteProduct.isPending]);

  // ── Confirmed delete ─────────────────────────────────────────
  const handleConfirmDelete = useCallback(() => {
    if (modal.kind !== "delete") return;
    const { product } = modal;

    deleteProduct.mutate(product.id, {
      onSettled: () => setModal({ kind: "none" }),
    });
  }, [modal, deleteProduct]);

  // ── Confirmed toggle ─────────────────────────────────────────
  const handleConfirmToggle = useCallback(() => {
    if (modal.kind !== "toggle") return;
    const { product } = modal;

    toggleActive.mutate(
      { id: product.id, isActive: !product.is_active },
      { onSettled: () => setModal({ kind: "none" }) },
    );
  }, [modal, toggleActive]);

  const columns: GridColDef<ProductWithDetails>[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Product",
        flex: 1.8,
        minWidth: 200,
        renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) => (
          <Box py={0.5}>
            <Typography variant="body2" fontWeight={600} lineHeight={1.3}>
              {row.name}
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
        field: "category",
        headerName: "Category",
        flex: 1,
        minWidth: 130,
        valueGetter: (_: unknown, row: ProductWithDetails) =>
          row.categories?.name ?? "—",
        renderCell: ({ value }: GridRenderCellParams) =>
          value === "—" ? (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          ) : (
            <Chip
              label={value}
              size="small"
              variant="outlined"
              sx={{ borderRadius: "6px", fontSize: "0.75rem" }}
            />
          ),
      },
      {
        field: "dosage_form",
        headerName: "Form",
        width: 120,
        renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) =>
          row.dosage_form ? (
            <Chip
              label={
                row.dosage_form.charAt(0).toUpperCase() +
                row.dosage_form.slice(1)
              }
              size="small"
              sx={{
                borderRadius: "6px",
                fontSize: "0.75rem",
                bgcolor: DOSAGE_COLORS[row.dosage_form] + "18",
                color: DOSAGE_COLORS[row.dosage_form],
                fontWeight: 600,
                border: `1px solid ${DOSAGE_COLORS[row.dosage_form]}40`,
              }}
            />
          ) : (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          ),
      },
      {
        field: "strength",
        headerName: "Capacity",
        width: 110,
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography
            variant="body2"
            color={value ? "text.primary" : "text.disabled"}
          >
            {value ?? "—"}
          </Typography>
        ),
      },
      {
        field: "selling_price",
        headerName: "Price (UGX)",
        width: 130,
        align: "right",
        headerAlign: "right",
        valueGetter: (_: unknown, row: ProductWithDetails) => {
          const defaultUnit = row.product_units?.find((u) => u.is_default);
          return defaultUnit?.selling_price ?? 0;
        },
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography variant="body2" fontWeight={600} fontFamily="monospace">
            {formatUGX(value as number)}
          </Typography>
        ),
      },
      {
        field: "is_vat_exempt",
        headerName: "VAT",
        width: 80,
        renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) =>
          row.is_vat_exempt ? (
            <Chip
              label="Exempt"
              size="small"
              color="warning"
              variant="outlined"
              sx={{ borderRadius: "6px", fontSize: "0.7rem" }}
            />
          ) : (
            <Chip
              label="18%"
              size="small"
              color="default"
              variant="outlined"
              sx={{ borderRadius: "6px", fontSize: "0.7rem" }}
            />
          ),
      },
      {
        field: "is_active",
        headerName: "Status",
        width: 90,
        renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) => (
          <Chip
            label={row.is_active ? "Active" : "Inactive"}
            size="small"
            color={row.is_active ? "success" : "default"}
            variant={row.is_active ? "filled" : "outlined"}
            sx={{ borderRadius: "6px", fontSize: "0.7rem" }}
          />
        ),
      },
      {
        field: "actions",
        headerName: "",
        width: 56,
        sortable: false,
        filterable: false,
        align: "center",
        renderCell: ({ row }: GridRenderCellParams<ProductWithDetails>) => (
          <RowActionsMenu
            row={row}
            onViewDetails={handleViewDetails}
            onEdit={handleEdit}
            onToggleActive={handleRequestToggle}
            onDelete={handleRequestDelete}
          />
        ),
      },
    ],
    [handleViewDetails, handleEdit, handleRequestToggle, handleRequestDelete],
  );

  return (
    <Box>
      {/* Toolbar */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        mb={2}
        alignItems="flex-start"
      >
        <TextField
          placeholder="Search by name, generic name, or barcode…"
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

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => navigate("/products/new")}
          sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          Add Product
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
              <MenuItem value="">All categories</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Dosage form</InputLabel>
            <Select
              value={dosageForm}
              onChange={(e) => setDosageForm(e.target.value)}
              label="Dosage form"
            >
              <MenuItem value="">All forms</MenuItem>
              {[
                "tablet",
                "capsule",
                "syrup",
                "cream",
                "injection",
                "drops",
                "other",
              ].map((f) => (
                <MenuItem key={f} value={f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
        </Stack>
      )}

      {/* Data grid */}
      <DataGrid
        rows={products}
        columns={columns}
        loading={isLoading}
        autoHeight
        density="comfortable"
        disableRowSelectionOnClick
        onRowClick={({ row }) => navigate(`/products/${row.id}`)}
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,

          "& .MuiDataGrid-row": {
            cursor: "pointer",
            borderBottom: "1px solid",
            borderColor: "divider",
          },

          "& .MuiDataGrid-cell": {
            alignItems: "center",
            borderBottom: "none",
            display: "flex",
            alignContent: "center",
          },

          "& .MuiDataGrid-columnHeaders": {
            borderBottom: "1px solid",
            borderColor: "divider",
          },

          "& .MuiDataGrid-columnSeparator": {
            visibility: "visible",
            color: "divider",
            "& svg": {
              color: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.18)",
            },
          },
          "& .MuiDataGrid-columnSeparator:hover svg": {
            color: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.5)"
                : "rgba(0,0,0,0.45)",
          },

          backgroundColor: "background.paper",

          "& .MuiDataGrid-columnHeader": {
            backgroundColor: "background.paper",
          },

          "& .MuiDataGrid-footerContainer": {
            borderTop: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.paper",
          },

          "& .MuiDataGrid-row:hover": {
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.04)"
                : "rgba(0,0,0,0.03)",
          },

          "& .MuiDataGrid-row.Mui-selected": {
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.06)",
            "&:hover": {
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(0,0,0,0.08)",
            },
          },
        }}
      />

      {/* ── Confirmation modals ──────────────────────────────────
          Rendered at ProductTable root so they sit above the grid
          in the stacking context without any z-index hacks.        */}
      <DeleteProductModal
        open={modal.kind === "delete"}
        product={modal.kind === "delete" ? modal.product : null}
        isPending={deleteProduct.isPending}
        onConfirm={handleConfirmDelete}
        onClose={handleClose}
      />

      <ToggleProductModal
        open={modal.kind === "toggle"}
        product={modal.kind === "toggle" ? modal.product : null}
        isPending={toggleActive.isPending}
        onConfirm={handleConfirmToggle}
        onClose={handleClose}
      />
    </Box>
  );
}
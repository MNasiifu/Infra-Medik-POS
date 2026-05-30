import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { AppDataGrid } from "@/components/molecules/AppDataGrid";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TableChartIcon from "@mui/icons-material/TableChart";
import PrintIcon from "@mui/icons-material/Print";

import { DashboardTemplate } from "@/components/templates/DashboardTemplate/DashboardTemplate";
import { useSalesReport, useTellers } from "@/hooks/reports/useReports";
import { useAuthStore } from "@/store/authStore";
import { downloadExcel } from "@/lib/reports/exportExcel";
import { printReport } from "@/lib/reports/exportPdf";
import {
  formatUGX,
  formatDateTime,
  formatDateInput,
  formatPaymentMethod,
} from "@/lib/formatters";
import type {
  SalesReportRow,
  SalesReportFilters,
} from "@/services/reportService";
import type { SaleType } from "@/types/database.types";

const SALE_TYPE_LABELS: Record<SaleType, string> = {
  walk_in: "Walk-in",
  account: "Account",
};

function monthStart() {
  const d = new Date();
  return formatDateInput(
    new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
  );
}

export function SalesReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const branchId = useAuthStore((s) => s.profile?.branch_id ?? null);

  const [filters, setFilters] = useState<SalesReportFilters>({
    dateFrom: monthStart(),
    dateTo: formatDateInput(new Date().toISOString()),
    branchId,
    tellerId: null,
    saleType: "",
  });
  const [enabled, setEnabled] = useState(false);

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useSalesReport(filters, enabled);
  const { data: tellers = [] } = useTellers();

  // Clear query cache on mount and cleanup on unmount
  // This prevents stale cached data from persisting when navigating away and back
  useEffect(() => {
    // On component mount: Clear any cached report data to ensure fresh state
    queryClient.removeQueries({
      queryKey: ["report-sales"],
      exact: false,
    });

    return () => {
      // On component unmount: Clear the cache when leaving the page
      // This prevents stale data from showing when the user navigates back
      queryClient.removeQueries({
        queryKey: ["report-sales"],
        exact: false,
      });
    };
  }, [queryClient]);

  // Reset enabled state if filters change (except for internal state changes)
  const handleRun = () => {
    if (enabled) {
      // Already enabled, just refetch with current filters
      refetch();
    } else {
      // Enable the query to trigger initial fetch
      setEnabled(true);
    }
  };

  const columns: GridColDef<SalesReportRow>[] = useMemo(
    () => [
      {
        field: "sale_number",
        headerName: "Sale #",
        width: 140,
        renderCell: ({ value, row }: GridRenderCellParams<SalesReportRow>) => (
          <Box py={0.5}>
            <Typography variant="body2" fontWeight={700} fontFamily="monospace">
              {value}
            </Typography>
            {row.is_voided && (
              <Chip
                label="Voided"
                size="small"
                color="error"
                sx={{ fontSize: "0.6rem", height: 16 }}
              />
            )}
          </Box>
        ),
      },
      {
        field: "sale_date",
        headerName: "Date",
        width: 160,
        valueFormatter: (v: string) => formatDateTime(v),
      },
      { field: "teller_name", headerName: "Teller", flex: 1, minWidth: 130 },
      {
        field: "customer_name",
        headerName: "Customer",
        flex: 1,
        minWidth: 130,
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
        field: "sale_type",
        headerName: "Type",
        width: 100,
        renderCell: ({ value }: GridRenderCellParams) => (
          <Chip
            label={SALE_TYPE_LABELS[value as SaleType] ?? value}
            size="small"
            variant="outlined"
            sx={{ borderRadius: "6px", fontSize: "0.7rem" }}
          />
        ),
      },
      {
        field: "items_count",
        headerName: "Items",
        width: 70,
        align: "right",
        headerAlign: "right",
      },
      {
        field: "subtotal_before_vat",
        headerName: "Before VAT",
        width: 130,
        align: "right",
        headerAlign: "right",
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography variant="body2" fontFamily="monospace">
            {formatUGX(value as number)}
          </Typography>
        ),
      },
      {
        field: "vat_amount",
        headerName: "VAT",
        width: 110,
        align: "right",
        headerAlign: "right",
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography variant="body2" fontFamily="monospace">
            {formatUGX(value as number)}
          </Typography>
        ),
      },
      {
        field: "total_amount",
        headerName: "Total",
        width: 130,
        align: "right",
        headerAlign: "right",
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography variant="body2" fontWeight={700} fontFamily="monospace">
            {formatUGX(value as number)}
          </Typography>
        ),
      },
      {
        field: "payment_methods",
        headerName: "Payment",
        width: 160,
        renderCell: ({ value }: GridRenderCellParams) => (
          <Typography variant="caption">
            {(value as string).split(", ").map(formatPaymentMethod).join(", ")}
          </Typography>
        ),
      },
    ],
    [],
  );

  const totalRevenue = rows
    .filter((r) => !r.is_voided)
    .reduce((s, r) => s + r.total_amount, 0);
  const totalVat = rows
    .filter((r) => !r.is_voided)
    .reduce((s, r) => s + r.vat_amount, 0);
  const voidedCount = rows.filter((r) => r.is_voided).length;
  const actualAmount = totalRevenue - totalVat;

  const handleExportExcel = async () => {
    await downloadExcel(
      "Sales Report",
      [
        { header: "Sale #", key: "sale_number", width: 18 },
        { header: "Date", key: "sale_date", width: 22 },
        { header: "Teller", key: "teller_name", width: 20 },
        { header: "Customer", key: "customer_name", width: 22 },
        { header: "Type", key: "sale_type", width: 12 },
        { header: "Items", key: "items_count", width: 8 },
        {
          header: "Before VAT",
          key: "subtotal_before_vat",
          width: 16,
          numFmt: "#,##0",
        },
        { header: "VAT (18%)", key: "vat_amount", width: 14, numFmt: "#,##0" },
        { header: "Total", key: "total_amount", width: 16, numFmt: "#,##0" },
        { header: "Payment", key: "payment_methods", width: 22 },
        { header: "Voided", key: "is_voided", width: 10 },
      ],
      rows.map((r) => ({
        ...r,
        sale_date: formatDateTime(r.sale_date),
      })) as Record<string, unknown>[],
      `INFRA_MEDIK_Sales_${filters.dateFrom}_to_${filters.dateTo}.xlsx`,
      {
        Period: `${filters.dateFrom} to ${filters.dateTo}`,
        Generated: new Date().toLocaleString("en-UG"),
      },
    );
  };

  const handlePrint = () => {
    printReport({
      title: "Sales Report",
      meta: { Period: `${filters.dateFrom} to ${filters.dateTo}` },
      summary: [
        { label: "Total Revenue", value: formatUGX(totalRevenue) },
        { label: "VAT Collected", value: formatUGX(totalVat) },
        { label: "Transactions", value: String(rows.length - voidedCount) },
        { label: "Voided", value: String(voidedCount) },
      ],
      columns: [
        { header: "Sale #", key: "sale_number" },
        {
          header: "Date",
          key: "sale_date",
          render: (v) => formatDateTime(v as string),
        },
        { header: "Teller", key: "teller_name" },
        { header: "Customer", key: "customer_name" },
        { header: "Type", key: "sale_type" },
        {
          header: "Before VAT",
          key: "subtotal_before_vat",
          align: "right",
          render: (v) => formatUGX(v as number),
        },
        {
          header: "VAT",
          key: "vat_amount",
          align: "right",
          render: (v) => formatUGX(v as number),
        },
        {
          header: "Total",
          key: "total_amount",
          align: "right",
          render: (v) => formatUGX(v as number),
        },
        { header: "Payment", key: "payment_methods" },
        {
          header: "Voided",
          key: "is_voided",
          render: (v) =>
            v ? '<span class="badge badge-red">Yes</span>' : "No",
        },
      ],
      rows: rows as unknown as Record<string, unknown>[],
    });
  };

  return (
    <DashboardTemplate>
      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={{ xs: 1.5, sm: 1.5 }}
        mb={3}
      >
        {/* Mobile: Arrow Back Icon + Title in one row; Desktop: Icon only */}
        <Box display="flex" alignItems="center" gap={1} width={{ xs: '100%', sm: 'auto' }}>
          <Tooltip title="Back to reports" arrow>
            <IconButton size="small" onClick={() => navigate("/reports")} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h5" fontWeight={700} sx={{ display: { xs: 'block', sm: 'none' } }}>
            Sales Report
          </Typography>
        </Box>

        {/* Desktop: Title + Subtitle; Mobile: Subtitle only */}
        <Box flex={{ sm: 1 }} width={{ xs: '100%', sm: 'auto' }}>
          <Typography variant="h5" fontWeight={700} sx={{ display: { xs: 'none', sm: 'block' } }}>
            Sales Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Full transaction list with VAT and payment breakdown.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} width={{ xs: '100%', sm: 'auto' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<TableChartIcon />}
            onClick={handleExportExcel}
            disabled={rows.length === 0}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Excel
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            disabled={rows.length === 0}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            PDF
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2.5 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' , md: '1fr 1fr 1fr 1fr 1fr' },
            justifyContent: 'center',
            alignContent: 'center',
          }}
        >
          <TextField
            label="From"
            type="date"
            size="small"
            fullWidth
            value={filters.dateFrom}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dateFrom: e.target.value }))
            }
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            fullWidth
            value={filters.dateTo}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dateTo: e.target.value }))
            }
            InputLabelProps={{ shrink: true }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Teller</InputLabel>
            <Select
              value={filters.tellerId ?? ""}
              label="Teller"
              onChange={(e) =>
                setFilters((f) => ({ ...f, tellerId: e.target.value || null }))
              }
            >
              <MenuItem value="">All tellers</MenuItem>
              {tellers.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.full_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Sale type</InputLabel>
            <Select
              value={filters.saleType ?? ""}
              label="Sale type"
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  saleType: e.target.value as SaleType | "",
                }))
              }
            >
              <MenuItem value="">All types</MenuItem>
              {(Object.entries(SALE_TYPE_LABELS) as [SaleType, string][]).map(
                ([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v}
                  </MenuItem>
                ),
              )}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            size="small"
            fullWidth
            startIcon={
              isLoading ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <PlayArrowIcon />
              )
            }
            onClick={handleRun}
            disabled={isLoading}
          >
            Run report
          </Button>
        </Box>
      </Paper>

      {/* Summary row */}
      {rows.length > 0 && enabled && (
        <Stack direction="row" spacing={3} mb={2} px={0.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total revenue (VAT INCLUSIVE)
            </Typography>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              fontFamily="monospace"
            >
              {formatUGX(totalRevenue)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              VAT collected
            </Typography>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              fontFamily="monospace"
            >
              {formatUGX(totalVat)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Revenue (Ex. VAT)
            </Typography>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              fontFamily="monospace"
            >
              {formatUGX(actualAmount)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Transactions
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {rows.length - voidedCount}
            </Typography>
          </Box>
          {voidedCount > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Voided
              </Typography>
              <Typography
                variant="subtitle1"
                fontWeight={700}
                color="error.main"
              >
                {voidedCount}
              </Typography>
            </Box>
          )}
        </Stack>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load report. Make sure get_sales_report RPC is deployed.
        </Alert>
      )}

      {!enabled && !isLoading && (
        <Box py={6} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Set your filters and click <strong>Run report</strong> to load data.
          </Typography>
        </Box>
      )}

      {enabled && (
        <AppDataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.sale_number}
          loading={isLoading}
          density="compact"
          pageSizeOptions={[50, 100, 200]}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
        />
      )}
    </DashboardTemplate>
  );
}

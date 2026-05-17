import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon   from '@mui/icons-material/ArrowBack'
import EditIcon        from '@mui/icons-material/Edit'
import DeleteIcon      from '@mui/icons-material/Delete'
import ToggleOnIcon    from '@mui/icons-material/ToggleOn'
import ToggleOffIcon   from '@mui/icons-material/ToggleOff'
import CategoryIcon    from '@mui/icons-material/Category'
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy'
import FactoryIcon     from '@mui/icons-material/Factory'
import PublicIcon       from '@mui/icons-material/Public'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import DescriptionIcon from '@mui/icons-material/Description'
import QrCodeIcon      from '@mui/icons-material/QrCode'
import StarIcon        from '@mui/icons-material/Star'

import { useProductDetail }    from '@/hooks/products/useProductDetail'
import { DeleteProductModal }  from '@/components/organisms/ProductTable/DeleteProductModal'
import { ToggleProductModal }  from '@/components/organisms/ProductTable/ToggleProductModal'
import { formatUGX, formatDateTime } from '@/lib/formatters'
import type { DosageForm }           from '@/types/database.types'

// ─── Dosage form colour map (mirrors ProductTable) ───────────────
const DOSAGE_COLORS: Record<DosageForm, string> = {
  tablet:      '#1565C0',
  capsule:     '#6A1B9A',
  syrup:       '#00838F',
  suspension:  '#0277BD',
  cream:       '#2E7D32',
  ointment:    '#558B2F',
  gel:         '#00695C',
  injection:   '#C62828',
  drops:       '#F57F17',
  powder:      '#4E342E',
  inhaler:     '#283593',
  patch:       '#4527A0',
  suppository: '#37474F',
  other:       '#546E7A',
}

// ─── Reusable info row ───────────────────────────────────────────
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <Box display="flex" alignItems="flex-start" gap={1.5} py={1}>
      <Box sx={{ color: 'text.secondary', mt: 0.25, flexShrink: 0 }}>
        {icon}
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={500} lineHeight={1.4}>
          {value || '—'}
        </Typography>
      </Box>
    </Box>
  )
}

// ─── Section header ──────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <Typography
      variant="subtitle2"
      fontWeight={700}
      sx={{ px: 2.5, pt: 2, pb: 1 }}
    >
      {title}
    </Typography>
  )
}

// ─── Main component ──────────────────────────────────────────────
export function ProductDetail() {
  const {
    product,
    isLoading,
    isError,
    modal,
    toggleActive,
    deleteProduct,
    goBack,
    goEdit,
    handleRequestToggle,
    handleRequestDelete,
    handleClose,
    handleConfirmDelete,
    handleConfirmToggle,
  } = useProductDetail()

  // ── Loading state ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={10}>
        <CircularProgress />
      </Box>
    )
  }

  // ── Error / not found ──────────────────────────────────────────
  if (isError || !product) {
    return (
      <Box>
        <IconButton size="small" onClick={goBack} sx={{ mb: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Product not found or failed to load.
        </Alert>
      </Box>
    )
  }

  const defaultUnit = product.product_units?.find((u) => u.is_default)

  return (
    <Box>
      {/* ═══════════════════ Header ═══════════════════════════════ */}
      <Box
        display="flex"
        alignItems="center"
        gap={1.5}
        mb={3}
        flexWrap="wrap"
      >
        <Tooltip title="Back to products" arrow>
          <IconButton size="small" onClick={goBack}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>

        <Box flex={1} minWidth={0}>
          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <Typography
              variant="h5"
              fontWeight={700}
              noWrap
              sx={{ maxWidth: '100%' }}
            >
              {product.name}
            </Typography>

            <Chip
              label={product.is_active ? 'Active' : 'Inactive'}
              size="small"
              color={product.is_active ? 'success' : 'default'}
              variant={product.is_active ? 'filled' : 'outlined'}
              sx={{ borderRadius: '6px', fontSize: '0.75rem' }}
            />

            {product.is_vat_exempt ? (
              <Chip
                label="VAT Exempt"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ borderRadius: '6px', fontSize: '0.7rem' }}
              />
            ) : (
              <Chip
                label="VAT 18%"
                size="small"
                color="default"
                variant="outlined"
                sx={{ borderRadius: '6px', fontSize: '0.7rem' }}
              />
            )}
          </Box>

          {product.generic_name && (
            <Typography variant="body2" color="text.secondary" mt={0.25}>
              {product.generic_name}
            </Typography>
          )}
        </Box>

        {/* Action buttons */}
        <Stack direction="row" spacing={1} flexShrink={0}>
          <Button
            variant="contained"
            size="small"
            startIcon={<EditIcon />}
            onClick={goEdit}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            size="small"
            color={product.is_active ? 'warning' : 'success'}
            startIcon={
              product.is_active ? (
                <ToggleOffIcon />
              ) : (
                <ToggleOnIcon />
              )
            }
            onClick={() => handleRequestToggle(product)}
          >
            {product.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleRequestDelete(product)}
          >
            Delete
          </Button>
        </Stack>
      </Box>

      {/* ═══════════════════ Content Grid ═════════════════════════ */}
      <Grid container spacing={2.5}>
        {/* ── Left column: Product information ──────────────────── */}
        <Grid item xs={12} md={5}>
          <Paper
            variant="outlined"
            sx={{ borderRadius: 2, height: '100%' }}
          >
            <SectionHeader title="Product Information" />
            <Divider />
            <Box px={2.5} pb={2}>
              <InfoRow
                icon={<CategoryIcon fontSize="small" />}
                label="Category"
                value={product.categories?.name}
              />
              <InfoRow
                icon={<LocalPharmacyIcon fontSize="small" />}
                label="Dosage Form"
                value={
                  product.dosage_form ? (
                    <Chip
                      label={
                        product.dosage_form.charAt(0).toUpperCase() +
                        product.dosage_form.slice(1)
                      }
                      size="small"
                      sx={{
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        bgcolor:
                          DOSAGE_COLORS[product.dosage_form] + '18',
                        color: DOSAGE_COLORS[product.dosage_form],
                        fontWeight: 600,
                        border: `1px solid ${DOSAGE_COLORS[product.dosage_form]}40`,
                      }}
                    />
                  ) : null
                }
              />
              <InfoRow
                icon={<FitnessCenterIcon fontSize="small" />}
                label="Strength"
                value={product.strength}
              />
              <InfoRow
                icon={<FactoryIcon fontSize="small" />}
                label="Manufacturer"
                value={product.manufacturers?.name}
              />
              <InfoRow
                icon={<PublicIcon fontSize="small" />}
                label="Country of Origin"
                value={product.countries?.name}
              />
              <InfoRow
                icon={<LocalShippingIcon fontSize="small" />}
                label="Supplier"
                value={product.suppliers?.name}
              />
              {product.description && (
                <InfoRow
                  icon={<DescriptionIcon fontSize="small" />}
                  label="Description"
                  value={product.description}
                />
              )}
            </Box>
          </Paper>
        </Grid>

        {/* ── Right column: Pricing + Barcodes ─────────────────── */}
        <Grid item xs={12} md={7}>
          <Stack spacing={2.5}>
            {/* ── Pricing table ────────────────────────────────── */}
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <SectionHeader title="Pricing & Units" />
              <Divider />
              {product.product_units && product.product_units.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Unit</TableCell>
                        <TableCell align="center">Factor</TableCell>
                        <TableCell align="right">Cost Price</TableCell>
                        <TableCell align="right">Before VAT</TableCell>
                        <TableCell align="right">VAT</TableCell>
                        <TableCell align="right">Selling Price</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {product.product_units.map((unit) => (
                        <TableRow key={unit.id} hover>
                          <TableCell>
                            <Box
                              display="flex"
                              alignItems="center"
                              gap={0.75}
                            >
                              <Typography
                                variant="body2"
                                fontWeight={600}
                              >
                                {unit.unit_name}
                              </Typography>
                              {unit.is_default && (
                                <Tooltip title="Default unit" arrow>
                                  <StarIcon
                                    fontSize="small"
                                    color="warning"
                                    sx={{ fontSize: 16 }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">
                              {unit.conversion_factor}×
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontFamily="monospace"
                            >
                              {formatUGX(unit.cost_price)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontFamily="monospace"
                            >
                              {formatUGX(unit.price_before_vat)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontFamily="monospace"
                              color="text.secondary"
                            >
                              {formatUGX(unit.vat_amount)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              fontFamily="monospace"
                              color="primary.main"
                            >
                              {formatUGX(unit.selling_price)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={unit.is_active ? 'Active' : 'Inactive'}
                              size="small"
                              color={unit.is_active ? 'success' : 'default'}
                              variant={unit.is_active ? 'filled' : 'outlined'}
                              sx={{
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box px={2.5} py={3} textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    No units configured for this product.
                  </Typography>
                </Box>
              )}

              {/* Default unit summary */}
              {defaultUnit && (
                <>
                  <Divider />
                  <Box
                    px={2.5}
                    py={1.5}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ bgcolor: 'action.hover' }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Default selling price ({defaultUnit.unit_name})
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      fontFamily="monospace"
                      color="primary.main"
                    >
                      {formatUGX(defaultUnit.selling_price)}
                    </Typography>
                  </Box>
                </>
              )}
            </Paper>

            {/* ── Barcodes ────────────────────────────────────── */}
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <SectionHeader title="Barcodes" />
              <Divider />
              {product.product_barcodes &&
              product.product_barcodes.length > 0 ? (
                <Box px={2.5} py={1.5}>
                  <Stack spacing={1}>
                    {product.product_barcodes.map((bc) => (
                      <Box
                        key={bc.id}
                        display="flex"
                        alignItems="center"
                        gap={1.5}
                        px={1.5}
                        py={1}
                        sx={{
                          bgcolor: 'action.hover',
                          borderRadius: 1.5,
                        }}
                      >
                        <QrCodeIcon
                          fontSize="small"
                          color="action"
                        />
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          fontFamily="monospace"
                          flex={1}
                        >
                          {bc.barcode}
                        </Typography>
                        <Chip
                          label={bc.is_generated ? 'Generated' : 'Manual'}
                          size="small"
                          variant="outlined"
                          color={bc.is_generated ? 'info' : 'default'}
                          sx={{
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Box px={2.5} py={3} textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    No barcodes assigned to this product.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Stack>
        </Grid>

        {/* ── Full-width: Metadata footer ──────────────────────── */}
        <Grid item xs={12}>
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 2.5,
              py: 1.5,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 3,
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body2">
                {formatDateTime(product.created_at)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body2">
                {formatDateTime(product.updated_at)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Product ID
              </Typography>
              <Typography
                variant="body2"
                fontFamily="monospace"
                fontSize="0.75rem"
              >
                {product.id}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* ═══════════════════ Confirmation Modals ═════════════════ */}
      <DeleteProductModal
        open={modal.kind === 'delete'}
        product={modal.kind === 'delete' ? modal.product : null}
        isPending={deleteProduct.isPending}
        onConfirm={handleConfirmDelete}
        onClose={handleClose}
      />
      <ToggleProductModal
        open={modal.kind === 'toggle'}
        product={modal.kind === 'toggle' ? modal.product : null}
        isPending={toggleActive.isPending}
        onConfirm={handleConfirmToggle}
        onClose={handleClose}
      />
    </Box>
  )
}

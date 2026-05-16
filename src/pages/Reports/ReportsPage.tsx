import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardActionArea, CardContent, Grid, Typography,
} from '@mui/material'
import ReceiptLongIcon     from '@mui/icons-material/ReceiptLong'
import InventoryIcon       from '@mui/icons-material/Inventory'
import HourglassTopIcon    from '@mui/icons-material/HourglassTop'
import AccountBalanceIcon  from '@mui/icons-material/AccountBalance'

import { DashboardTemplate } from '@/components/templates/DashboardTemplate/DashboardTemplate'

const REPORTS = [
  {
    title:       'Sales Report',
    description: 'Full transaction list with VAT, payment methods, and teller breakdown.',
    icon:        <ReceiptLongIcon sx={{ fontSize: 36 }} />,
    color:       'primary.main',
    bg:          'primary.50',
    path:        '/reports/sales',
  },
  {
    title:       'Stock Valuation',
    description: 'Current inventory value by product, batch, and expiry date.',
    icon:        <InventoryIcon sx={{ fontSize: 36 }} />,
    color:       'success.main',
    bg:          'success.50',
    path:        '/reports/stock',
  },
  {
    title:       'Expiry Report',
    description: 'Batches expiring within a chosen window — identify at-risk stock.',
    icon:        <HourglassTopIcon sx={{ fontSize: 36 }} />,
    color:       'warning.dark',
    bg:          'warning.50',
    path:        '/reports/expiry',
  },
  {
    title:       'VAT Report',
    description: 'Total VAT collected with daily breakdown — ready for URA filing.',
    icon:        <AccountBalanceIcon sx={{ fontSize: 36 }} />,
    color:       'info.main',
    bg:          'info.50',
    path:        '/reports/vat',
  },
]

export function ReportsPage() {
  const navigate = useNavigate()

  return (
    <DashboardTemplate>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>Reports</Typography>
        <Typography variant="body2" color="text.secondary">
          Generate, view, and export detailed reports. All reports support PDF print and Excel download.
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {REPORTS.map((r) => (
          <Grid item xs={12} sm={6} md={3} key={r.path}>
            <Card
              sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}
              elevation={0}
            >
              <CardActionArea
                sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: 2.5 }}
                onClick={() => navigate(r.path)}
              >
                <Box
                  sx={{
                    width: 56, height: 56,
                    borderRadius: 2.5,
                    bgcolor: r.bg,
                    color: r.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  {r.icon}
                </Box>
                <CardContent sx={{ p: 0 }}>
                  <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                    {r.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {r.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </DashboardTemplate>
  )
}

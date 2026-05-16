import { Box, Card, CardContent, Typography, Skeleton, type SxProps } from '@mui/material'
import type { ReactNode } from 'react'
import type { Theme } from '@mui/material/styles'

interface Props {
  title:      string
  value:      string | number
  subtitle?:  string
  icon?:      ReactNode
  iconColor?: string
  iconBg?:    string
  trend?:     { value: number; label?: string }
  loading?:   boolean
  sx?:        SxProps<Theme>
}

export function StatCard({
  title, value, subtitle, icon, iconColor = 'primary.main',
  iconBg = 'primary.50', trend, loading = false, sx,
}: Props) {
  const trendPositive = (trend?.value ?? 0) >= 0

  return (
    <Card sx={{ height: '100%', ...sx }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Box flex={1} minWidth={0}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              textTransform="uppercase"
              letterSpacing={0.5}
              display="block"
              mb={0.75}
            >
              {title}
            </Typography>

            {loading ? (
              <>
                <Skeleton variant="text" width="60%" height={36} />
                <Skeleton variant="text" width="40%" height={18} />
              </>
            ) : (
              <>
                <Typography variant="h4" fontWeight={700} lineHeight={1.1} mb={0.5} noWrap>
                  {value}
                </Typography>

                {(subtitle || trend) && (
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    {trend && (
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        color={trendPositive ? 'success.main' : 'error.main'}
                      >
                        {trendPositive ? '+' : ''}{trend.value}%
                        {trend.label ? ` ${trend.label}` : ''}
                      </Typography>
                    )}
                    {subtitle && (
                      <Typography variant="caption" color="text.secondary">
                        {subtitle}
                      </Typography>
                    )}
                  </Box>
                )}
              </>
            )}
          </Box>

          {icon && (
            <Box
              sx={{
                width: 48, height: 48,
                borderRadius: 2.5,
                bgcolor: iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: iconColor,
                '& svg': { fontSize: 24 },
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

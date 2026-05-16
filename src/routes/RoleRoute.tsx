import { Navigate, Outlet } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import { usePermissions } from '@/hooks/auth/usePermissions'
import type { UserRole } from '@/types/database.types'

interface Props {
  allowedRoles: UserRole[]
}

export function RoleRoute({ allowedRoles }: Props) {
  const { role } = usePermissions()

  if (!role) return <Navigate to="/login" replace />

  if (!allowedRoles.includes(role)) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="60vh"
        gap={2}
      >
        <LockIcon sx={{ fontSize: 64, color: 'error.main', opacity: 0.5 }} />
        <Typography variant="h5" fontWeight={700}>Access Denied</Typography>
        <Typography variant="body2" color="text.secondary">
          You do not have permission to view this page.
        </Typography>
        <Button variant="contained" onClick={() => window.history.back()}>
          Go back
        </Button>
      </Box>
    )
  }

  return <Outlet />
}

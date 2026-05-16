import { RouterProvider } from 'react-router-dom'
import { router }         from '@/routes'
import { NotificationManager } from '@/components/organisms/NotificationManager/NotificationManager'
import { ErrorBoundary }       from '@/components/organisms/ErrorBoundary/ErrorBoundary'

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <NotificationManager />
    </ErrorBoundary>
  )
}

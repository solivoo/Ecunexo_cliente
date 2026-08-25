import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/store/authSlice'

export function RequireAuth() {
  const authed = useAppSelector(selectIsAuthenticated)
  const location = useLocation()

  if (!authed) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

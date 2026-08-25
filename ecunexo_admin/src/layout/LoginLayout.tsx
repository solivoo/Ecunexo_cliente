import { Navigate } from 'react-router-dom';
import { resolvePostAuthPath } from '@/features/auth/resolvePostAuthPath';
import LoginPage from '@/pages/auth/LoginPage';
import {
  selectIsAuthenticated,
  selectIsSubscriptionHolder,
  selectTenantId,
} from '@/store/authSlice';
import { useAppSelector } from '@/store/hooks';
import '@pages/auth/loginPage.css';

const LoginLayout = () => {
  const authed = useAppSelector(selectIsAuthenticated);
  const isSubscriptionHolder = useAppSelector(selectIsSubscriptionHolder);
  const tenantId = useAppSelector(selectTenantId);

  if (authed) {
    return (
      <Navigate
        to={resolvePostAuthPath({ isSubscriptionHolder, tenantId })}
        replace
      />
    );
  }

  return (
    <main className="login-page login-page--dense">
      <div className="login-page__glow" aria-hidden />
      <div className="login-page__inner">
        <LoginPage />
      </div>
    </main>
  );
};

export default LoginLayout;

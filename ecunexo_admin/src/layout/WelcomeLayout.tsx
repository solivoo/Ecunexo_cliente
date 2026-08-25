import { Navigate, Outlet } from 'react-router-dom';
import { resolvePostAuthPath } from '@/features/auth/resolvePostAuthPath';
import {
  selectIsAuthenticated,
  selectIsSubscriptionHolder,
  selectTenantId,
} from '@/store/authSlice';
import { useAppSelector } from '@/store/hooks';
import '@pages/auth/loginPage.css';

const WelcomeLayout = () => {
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
    <main className="login-page welcome-onboarding login-page--dense">
      <div className="login-page__glow" aria-hidden />
      <div className="login-page__inner">
        <Outlet />
      </div>
    </main>
  );
};

export default WelcomeLayout;

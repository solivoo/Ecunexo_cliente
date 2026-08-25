import { useSyncExternalStore } from 'react';
import logoDark from '@assets/solo_logo_ecunexo_dark.svg';
import logoLight from '@assets/solo_logo_ecunexo_light.svg';

function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains('sf-dark-mode') ? 'dark' : 'light';
}

const Branding = () => {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot);

  return (
    <div className="login-page__brand">
      <div className="login-page__logo">
        <img
          src={theme === 'dark' ? logoDark : logoLight}
          alt="EcuNexo"
          className="login-page__logo-img"
        />
      </div>
      <h1 className="login-page__title login-page__title--visually-hidden">EcuNexo</h1>
      <p className="login-page__subtitle">Management Suite — Acceso corporativo</p>
    </div>
  );
};

export default Branding;

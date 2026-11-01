const Branding = () => {
  return (
    <div className="login-page__brand">
      <div className="login-page__logo">
        <span className="ecu-wordmark ecu-wordmark--hero" aria-label="EcuNexo">
          <span className="ecu-wordmark__name" aria-hidden>
            Ecu<strong>Ne<span className="ecu-wordmark__x">x</span>o</strong>
          </span>
        </span>
      </div>
      <h1 className="login-page__title login-page__title--visually-hidden">EcuNexo</h1>
      <p className="login-page__subtitle">Management Suite — Acceso corporativo</p>
    </div>
  )
}

export default Branding

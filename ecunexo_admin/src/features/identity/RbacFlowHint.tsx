export function RbacFlowHint() {
  return (
    <aside className="ecu-rbac-hint" aria-label="Flujo RBAC y ABAC">
      <p className="ecu-rbac-hint__title">RBAC + ABAC en EcuNexo</p>
      <ol className="ecu-rbac-hint__steps">
        <li>
          <strong>Usuarios</strong> — alta en el tenant.
        </li>
        <li>
          <strong>Roles</strong> — agrupan permisos; se asignan a usuarios (RBAC).
        </li>
        <li>
          <strong>Permisos</strong> — catálogo global; se otorgan a roles.
        </li>
        <li>
          <strong>Políticas</strong> — reglas ABAC (Allow/Deny + condición) sobre cada permiso.
        </li>
      </ol>
    </aside>
  )
}

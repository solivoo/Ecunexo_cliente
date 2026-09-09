import { Button } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { EditUserPasswordSection } from '@/features/identity/EditUserPasswordSection'
import { EditUserProfileSection } from '@/features/identity/EditUserProfileSection'
import { useEditUserPage } from '@/features/identity/useEditUserPage'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'

export function EditUserPage() {
  const page = useEditUserPage()

  if (!page.canUpdate) {
    return (
      <TenantSessionGate title="Editar usuario" lead="Actualiza la ficha de la persona.">
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres identity.users.update para editar usuarios.
          </p>
          <Button type="button" variant="outline" onClick={() => page.navigate(page.detailPath)}>
            Volver a la ficha
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Editar usuario" lead="Actualiza la ficha de la persona.">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            {page.user
              ? `Editar a ${page.user.name} (${page.user.email}).`
              : 'Editar datos de perfil.'}
          </p>
          <EcuPageActions
            items={page.actionItems}
            variant="outline"
            triggerLabel="Acciones de editar usuario"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => page.navigate(route)}
          />
        </div>

        <PageLoadState
          loading={page.loading}
          error={page.error && !page.user ? page.error : null}
          empty={!page.user && !page.loading}
        >
          {page.user ? (
            <>
              {page.error ? (
                <p className="welcome-onboarding__error" role="alert">
                  {page.error}
                </p>
              ) : null}

              <EditUserProfileSection
                user={page.user}
                email={page.email}
                onEmailChange={page.setEmail}
                name={page.name}
                onNameChange={page.setName}
                departmentId={page.departmentId}
                onDepartmentChange={page.setDepartmentId}
                departmentOptions={page.departmentOptions}
                canReadDepartments={page.canReadDepartments}
                departmentsCount={page.departments.length}
                jobTitle={page.jobTitle}
                onJobTitleChange={page.setJobTitle}
                phone={page.phone}
                onPhoneChange={page.setPhone}
                roleId={page.roleId}
                onRoleChange={page.setRoleId}
                roleOptions={page.roleOptions}
                canManageRoles={page.canManageRoles}
                roles={page.roles}
                formLocked={page.formLocked}
                busy={page.busy}
                onBack={() => page.navigate(page.detailPath)}
                onSubmit={(e) => void page.onSubmitProfile(e)}
              />

              <EditUserPasswordSection
                password={page.password}
                passwordConfirm={page.passwordConfirm}
                onPasswordChange={page.setPassword}
                onPasswordConfirmChange={page.setPasswordConfirm}
                locked={page.formLocked}
                userDisabled={page.user.isDisabled}
                passwordBusy={page.passwordBusy}
                onSave={() => void page.onSavePassword()}
                onSendEmail={() => void page.onSendResetEmail()}
              />
            </>
          ) : null}
        </PageLoadState>
      </div>
    </TenantSessionGate>
  )
}

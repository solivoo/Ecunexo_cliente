import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, CheckButton, DataGrid, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  type DocumentTypeOption,
  validateEcuadorTaxId,
  validateEmail,
  validatePhone,
} from '@/lib/ecuadorTaxIdValidator'
import {
  createRepairCustomer,
  listRepairCustomers,
  toggleRepairCustomerStatus,
  updateRepairCustomer,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { RepairCustomerDto } from '@/types/repairsApi'

type CustomerRow = RepairCustomerDto & Record<string, unknown>

export default function RepairCustomersListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canManage = useHasPermission('repairs.batches.import') || useHasPermission('repairs.batches.read')

  const [customers, setCustomers] = useState<RepairCustomerDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtro de estado
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modal de Crear / Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<RepairCustomerDto | null>(null)

  // Campos de formulario
  const [docType, setDocType] = useState<DocumentTypeOption>('AUTO')
  const [taxId, setTaxId] = useState('')
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Cargar clientes
  const loadCustomers = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listRepairCustomers(tenantId)
      setCustomers(data)
    } catch (err: unknown) {
      setError(readApiError(err, 'No fue posible cargar el directorio de clientes.'))
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  // Abrir modal si query string contiene ?nuevo=1
  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      handleOpenCreate()
      searchParams.delete('nuevo')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Validaciones en vivo
  const taxIdValidation = useMemo(() => {
    if (!taxId.trim()) return null
    return validateEcuadorTaxId(taxId, docType)
  }, [taxId, docType])

  const emailValidation = useMemo(() => {
    return validateEmail(contactEmail)
  }, [contactEmail])

  const phoneValidation = useMemo(() => {
    return validatePhone(contactPhone)
  }, [contactPhone])

  const isFormValid = useMemo(() => {
    if (!name.trim()) return false
    if (taxId.trim() && taxIdValidation && !taxIdValidation.isValid) return false
    if (contactEmail.trim() && !emailValidation.isValid) return false
    if (contactPhone.trim() && !phoneValidation.isValid) return false
    return true
  }, [name, taxId, taxIdValidation, contactEmail, emailValidation, contactPhone, phoneValidation])

  // Manejo de Modal
  const handleOpenCreate = () => {
    setEditingCustomer(null)
    setDocType('AUTO')
    setTaxId('')
    setName('')
    setContactPerson('')
    setContactEmail('')
    setContactPhone('')
    setAddress('')
    setNotes('')
    setIsActive(true)
    setFormError(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (customer: RepairCustomerDto) => {
    setEditingCustomer(customer)
    setDocType('AUTO')
    setTaxId(customer.taxId ?? '')
    setName(customer.name)
    setContactPerson(customer.contactPerson ?? '')
    setContactEmail(customer.contactEmail ?? '')
    setContactPhone(customer.contactPhone ?? '')
    setAddress(customer.address ?? '')
    setNotes(customer.notes ?? '')
    setIsActive(customer.isActive)
    setFormError(null)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditingCustomer(null)
    setFormError(null)
  }

  const handleSaveCustomer = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (!tenantId) return

    if (!name.trim()) {
      setFormError('La razón social o nombre comercial es obligatorio.')
      return
    }

    if (taxId.trim() && taxIdValidation && !taxIdValidation.isValid) {
      setFormError(taxIdValidation.error || 'La identificación tributaria ingresada no es válida.')
      return
    }

    if (contactEmail.trim() && !emailValidation.isValid) {
      setFormError(emailValidation.error || 'El correo electrónico ingresado no es válido.')
      return
    }

    if (contactPhone.trim() && !phoneValidation.isValid) {
      setFormError(phoneValidation.error || 'El teléfono de contacto no es válido.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = {
        name: name.trim(),
        taxId: taxId.trim() || null,
        contactPerson: contactPerson.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        isActive,
      }

      if (editingCustomer) {
        const updated = await updateRepairCustomer(tenantId, editingCustomer.id, payload)
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        toast.show({
          title: 'Cliente actualizado',
          message: `Los datos del cliente "${updated.name}" se guardaron correctamente.`,
          variant: 'success',
        })
      } else {
        const created = await createRepairCustomer(tenantId, payload)
        setCustomers((prev) => [created, ...prev])
        toast.show({
          title: 'Cliente registrado',
          message: `El cliente "${created.name}" fue creado exitosamente con validación de identidad.`,
          variant: 'success',
        })
      }

      setModalOpen(false)
    } catch (err: unknown) {
      setFormError(readApiError(err, 'No fue posible guardar los datos del cliente.'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (customer: RepairCustomerDto) => {
    if (!tenantId) return
    const newStatus = !customer.isActive
    try {
      const updated = await toggleRepairCustomerStatus(tenantId, customer.id, newStatus)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      toast.show({
        title: newStatus ? 'Cliente reactivado' : 'Cliente desactivado',
        message: `El estado del cliente "${customer.name}" es ahora ${newStatus ? 'Activo' : 'Inactivo'}.`,
        variant: 'info',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al cambiar estado',
        message: readApiError(err, 'No se pudo modificar el estado del cliente.'),
        variant: 'error',
      })
    }
  }

  // Filtrado y KPIs
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter === 'active') return c.isActive
      if (statusFilter === 'inactive') return !c.isActive
      return true
    })
  }, [customers, statusFilter])

  const stats = useMemo(() => {
    const total = customers.length
    const active = customers.filter((c) => c.isActive).length
    const inactive = total - active
    const withTaxId = customers.filter((c) => Boolean(c.taxId && c.taxId.trim())).length
    return { total, active, inactive, withTaxId }
  }, [customers])

  // Paginación y mensajes DataGrid
  const messages = useMemo(() => createSpanishDataGridMessages('cliente', 'clientes'), [])
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging(10)

  // Columnas DataGrid
  const columns = useMemo(
    (): ColumnDef<CustomerRow>[] => [
      {
        key: 'name',
        header: 'Razón Social / Empresa',
        width: 250,
        sortable: true,
        renderCell: (_v, row: CustomerRow) => (
          <div className="flex flex-col py-1">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-primary/70 shrink-0" aria-hidden />
              <span className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</span>
            </div>
            {row.contactPerson && (
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-6">
                Contacto: {row.contactPerson}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'taxId',
        header: 'RUC / Identificación',
        width: 190,
        sortable: true,
        renderCell: (_v, row: CustomerRow) => {
          if (!row.taxId) {
            return <span className="text-xs text-slate-400 italic">No registrado</span>
          }
          const validation = validateEcuadorTaxId(row.taxId)
          let tone: 'primary' | 'success' | 'warning' | 'neutral' = 'neutral'
          if (validation.isValid) {
            tone = validation.category.startsWith('ruc') ? 'primary' : 'success'
          }
          return (
            <div className="flex flex-col gap-1 py-1">
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200 text-xs">
                {row.taxId}
              </span>
              <StatusBadge tone={tone}>
                {validation.isValid ? validation.label.split(' ')[0] : 'No Verificado'}
              </StatusBadge>
            </div>
          )
        },
      },
      {
        key: 'contactEmail',
        header: 'Contacto y Canales',
        width: 240,
        sortable: true,
        renderCell: (_v, row: CustomerRow) => (
          <div className="flex flex-col gap-1 py-1 text-xs">
            {row.contactEmail ? (
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Mail size={13} className="text-slate-400 shrink-0" aria-hidden />
                <span className="truncate">{row.contactEmail}</span>
              </div>
            ) : null}
            {row.contactPhone ? (
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Phone size={13} className="text-slate-400 shrink-0" aria-hidden />
                <span>{row.contactPhone}</span>
              </div>
            ) : null}
            {!row.contactEmail && !row.contactPhone && (
              <span className="text-slate-400 italic">Sin canales de contacto</span>
            )}
          </div>
        ),
      },
      {
        key: 'address',
        header: 'Ubicación / Dirección',
        width: 200,
        sortable: true,
        renderCell: (_v, row: CustomerRow) => (
          <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300 py-1">
            {row.address ? (
              <>
                <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" aria-hidden />
                <span className="line-clamp-2">{row.address}</span>
              </>
            ) : (
              <span className="text-slate-400 italic">—</span>
            )}
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 120,
        sortable: true,
        renderCell: (_v, row: CustomerRow) => (
          <StatusBadge tone={row.isActive ? 'success' : 'neutral'} withDot>
            {row.isActive ? 'Activo' : 'Inactivo'}
          </StatusBadge>
        ),
      },
      {
        key: 'id',
        header: 'Acciones',
        width: 160,
        sortable: false,
        renderCell: (_v, row: CustomerRow) => (
          <div className="flex items-center gap-1.5 py-1">
            <GridIconButton
              label="Editar cliente"
              icon={Pencil}
              onClick={() => handleOpenEdit(row)}
            />
            <GridIconButton
              label={row.isActive ? 'Desactivar cliente' : 'Activar cliente'}
              icon={Power}
              onClick={() => void handleToggleStatus(row)}
            />
            <GridIconButton
              label="Ver Lotes de Reparación"
              icon={Layers}
              onClick={() => navigate(`/taller/lotes?clienteId=${row.id}`)}
            />
          </div>
        ),
      },
    ],
    [navigate]
  )

  return (
    <TenantSessionGate
      title="Directorio de Clientes"
      lead="Gestión integral de clientes corporativos, marcas fabricantes y aliados comerciales con validación de identidad SRI."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Directorio de Clientes"
          subtitle="Empresas aliadas, clientes corporativos y fabricantes con validación tributaria oficial de cédula y RUC."
          badge={
            <StatusBadge tone="primary" withDot>
              {customers.length} {customers.length === 1 ? 'Cliente registrado' : 'Clientes registrados'}
            </StatusBadge>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadCustomers()}
                disabled={loading}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden />
                Actualizar
              </Button>
              {canManage && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleOpenCreate}
                >
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Nuevo Cliente
                </Button>
              )}
            </div>
          }
        />

        {/* Tira de KPIs / Métricas */}
        <div className="ecu-stat-grid" aria-label="Métricas del directorio de clientes">
          <StatCard
            label="Total Clientes"
            value={stats.total}
            icon="group"
            toneColor="#4f46e5"
            footerText="En el tenant operativo actual"
          />
          <StatCard
            label="Clientes Activos"
            value={stats.active}
            icon="verified"
            toneColor="#10b981"
            footerText="Habilitados para lotes y servicios"
          />
          <StatCard
            label="Clientes Inactivos"
            value={stats.inactive}
            icon="pause_circle"
            toneColor="#f59e0b"
            footerText="Suspendidos o temporalmente inactivos"
          />
          <StatCard
            label="Con RUC / SRI Verificado"
            value={stats.withTaxId}
            icon="shield_check"
            toneColor="#0284c7"
            footerText="Con identificación fiscal registrada"
          />
        </div>

        {/* Listado y Filtros */}
        <SectionCard
          title="Cartera y Directorio"
          subtitle="Consulta, búsqueda instantánea y mantenimiento de información de contacto y fiscal"
        >
          {error && (
            <div className="ecu-form-error-banner mb-4" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Barra de Filtro de Estado */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Filtro por estado:
              </span>
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <Button
                  type="button"
                  variant={statusFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  Todos ({stats.total})
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === 'active' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                >
                  Activos ({stats.active})
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === 'inactive' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('inactive')}
                >
                  Inactivos ({stats.inactive})
                </Button>
              </div>
            </div>
          </div>

          {filteredCustomers.length === 0 && !loading ? (
            <EmptyState
              icon="group"
              title={
                statusFilter === 'all'
                  ? 'No hay clientes registrados en este momento'
                  : 'No se encontraron clientes con el filtro seleccionado'
              }
              description="Registra empresas aliadas o clientes corporativos con validación de cédula y RUC ecuatoriano para utilizarlos en lotes de reparación y en todo el sistema."
              action={
                canManage ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleOpenCreate}
                  >
                    <Plus size={16} strokeWidth={2} aria-hidden />
                    Registrar Primer Cliente
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-customers-grid"
              dataSource={filteredCustomers as CustomerRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={320}
              searchPlaceholder="Buscar por razón social, RUC o contacto..."
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>

        {/* Modal Popup de Registro / Edición */}
        <Popup
          open={modalOpen}
          title={editingCustomer ? 'Editar Cliente Corporativo' : 'Registrar Nuevo Cliente'}
          onClose={handleCloseModal}
          width="min(92vw, 38rem)"
          actions={[
            {
              id: 'cancel',
              label: 'Cancelar',
              variant: 'outline',
              onClick: handleCloseModal,
              disabled: saving,
            },
            {
              id: 'save',
              label: saving ? 'Guardando...' : editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente',
              variant: 'primary',
              onClick: () => void handleSaveCustomer(),
              disabled: saving || !isFormValid,
              loading: saving,
            },
          ]}
        >
          <form onSubmit={handleSaveCustomer} className="space-y-4" noValidate>
            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* Fila 1: Razón Social */}
            <div>
              <TextBox
                id="customer-name"
                label="Razón Social / Nombre Comercial *"
                labelPosition="outlined"
                variant="outline"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setName(e.target.value)
                  if (formError) setFormError(null)
                }}
                placeholder="Ej. Whirlpool del Ecuador S.A., Mabe, Comercial Andina..."
                fullWidth
                disabled={saving}
              />
              {!name.trim() && (
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Nombre obligatorio con el que se identificará al cliente en lotes y comprobantes.
                </span>
              )}
            </div>

            {/* Fila 2: Tipo de Identificación y RUC/Cédula */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Select
                  id="customer-doc-type"
                  label="Tipo de Identificación"
                  labelPosition="outlined"
                  variant="outline"
                  value={docType}
                  onChange={(val: string) => setDocType(val as DocumentTypeOption)}
                  options={[
                    { value: 'AUTO', label: 'Detección automática (RUC / Cédula)' },
                    { value: 'RUC', label: 'RUC Ecuador (13 dígitos)' },
                    { value: 'CEDULA', label: 'Cédula de Identidad (10 dígitos)' },
                    { value: 'PASAPORTE', label: 'Pasaporte / Extranjero' },
                    { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final (9999999999999)' },
                  ]}
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div>
                <TextBox
                  id="customer-tax-id"
                  label="RUC o Identificación Fiscal"
                  labelPosition="outlined"
                  variant="outline"
                  value={taxId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setTaxId(e.target.value)
                    if (formError) setFormError(null)
                  }}
                  placeholder="Ej. 1790010937001 o 1710034065..."
                  fullWidth
                  disabled={saving}
                />
                {taxIdValidation && (
                  <div className="mt-1">
                    {taxIdValidation.isValid ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 size={13} className="shrink-0" />
                        {taxIdValidation.label}
                      </span>
                    ) : (
                      <span className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                        <AlertCircle size={13} className="shrink-0" />
                        {taxIdValidation.error}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Fila 3: Persona de Contacto y Teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <TextBox
                  id="customer-person"
                  label="Persona de Contacto / Representante"
                  labelPosition="outlined"
                  variant="outline"
                  value={contactPerson}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setContactPerson(e.target.value)}
                  placeholder="Ej. Ing. Carlos Mendoza (Jefe de Garantías)"
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div>
                <TextBox
                  id="customer-phone"
                  label="Teléfono de Contacto"
                  labelPosition="outlined"
                  variant="outline"
                  value={contactPhone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setContactPhone(e.target.value)
                    if (formError) setFormError(null)
                  }}
                  placeholder="Ej. 0991234567 o 042999888"
                  fullWidth
                  disabled={saving}
                />
                {contactPhone.trim() && !phoneValidation.isValid && (
                  <span className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle size={13} className="shrink-0" />
                    {phoneValidation.error}
                  </span>
                )}
              </div>
            </div>

            {/* Fila 4: Correo Electrónico */}
            <div>
              <TextBox
                id="customer-email"
                type="email"
                label="Correo Electrónico de Notificaciones"
                labelPosition="outlined"
                variant="outline"
                value={contactEmail}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setContactEmail(e.target.value)
                  if (formError) setFormError(null)
                }}
                placeholder="Ej. garantias@marca.com, servicio@distribuidor.ec"
                fullWidth
                disabled={saving}
              />
              {contactEmail.trim() && !emailValidation.isValid && (
                <span className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 font-medium">
                  <AlertCircle size={13} className="shrink-0" />
                  {emailValidation.error}
                </span>
              )}
            </div>

            {/* Fila 5: Dirección */}
            <div>
              <TextBox
                id="customer-address"
                label="Dirección / Instalaciones"
                labelPosition="outlined"
                variant="outline"
                value={address}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
                placeholder="Ej. Av. Juan Tanca Marengo Km 4.5, Bodega Central #4"
                fullWidth
                disabled={saving}
              />
            </div>

            {/* Fila 6: Observaciones y Notas */}
            <div>
              <TextBox
                id="customer-notes"
                label="Observaciones y Condiciones Especiales"
                labelPosition="outlined"
                variant="outline"
                value={notes}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                placeholder="Condiciones de despacho, horario de recepción o acuerdos de garantía..."
                fullWidth
                disabled={saving}
              />
            </div>

            {/* Fila 7: Estado Activo / Inactivo con CheckButton */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <CheckButton
                id="customer-active-toggle"
                checked={isActive}
                onChange={(chk: boolean) => setIsActive(chk)}
                disabled={saving}
                variant={isActive ? 'primary' : 'outline'}
                size="sm"
              >
                {isActive
                  ? 'Cliente Activo (habilitado para asociar nuevos lotes)'
                  : 'Cliente Inactivo (deshabilitado para nuevos lotes)'}
              </CheckButton>
            </div>
          </form>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}

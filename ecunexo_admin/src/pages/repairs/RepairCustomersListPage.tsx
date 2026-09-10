import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Button,
  CheckButton,
  DataGrid,
  Popup,
  Select,
  TextArea,
  TextBox,
  useToast,
  type ColumnDef,
  type PageActionItem,
} from 'glubox'
import {
  EcuPageActions,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { GridIconButton } from '@/components/ui/GridIconButton'
import {
  AlertCircle,
  Building2,
  FilePlus,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Power,
  User,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { isoInstantInRange } from '@/lib/gridLookback'
import { readApiError } from '@/lib/readApiError'
import {
  type DocumentTypeOption,
  validateEcuadorTaxId,
  validateEmail,
  validatePhone,
} from '@/lib/ecuadorTaxIdValidator'
import {
  createCustomer,
  listCustomerTypes,
  listCustomers,
  toggleCustomerStatus,
  updateCustomer,
} from '@/services/customersApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  CustomerIdentificationType,
  CustomerType,
  CUSTOMER_IDENTIFICATION_LABELS,
  resolveCustomerTypeMeta,
  type CustomerDto,
  type CustomerTypeDefinitionDto,
} from '@/types/customersApi'
import './ecu-customer-form.css'

type CustomerRow = CustomerDto & Record<string, unknown>

export default function RepairCustomersListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission('customers.read') ||
    useHasPermission('customers.manage') ||
    useHasPermission('repairs.batches.read')
  const canManage = useHasPermission('customers.manage')
  const canReadBatches = useHasPermission('repairs.batches.read')
  const canImportBatches = useHasPermission('repairs.batches.import')

  const [customers, setCustomers] = useState<CustomerDto[]>([])
  const [customerTypes, setCustomerTypes] = useState<CustomerTypeDefinitionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const { from, to, setRange, lookback } = useGridDateRange()

  // Modal de Crear / Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerDto | null>(null)

  // Campos de formulario
  const [customerType, setCustomerType] = useState<CustomerType>(CustomerType.CorporativoB2B)
  const [identificationType, setIdentificationType] = useState<CustomerIdentificationType>(
    CustomerIdentificationType.Ruc
  )
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

  const loadCustomers = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      setError(null)
      try {
        const [data, types] = await Promise.all([
          listCustomers(tenantId),
          listCustomerTypes(tenantId, false),
        ])
        setCustomers(data)
        setCustomerTypes(types)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Directorio de clientes sincronizado con éxito.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No fue posible cargar el directorio de clientes.')
        setError(message)
        setCustomers([])
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    if (canRead) void loadCustomers({ silent: true })
  }, [canRead, loadCustomers])

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

  // Sincronización automática de identificador al cambiar tipo de cliente
  const handleCustomerTypeChange = (newTypeStr: string) => {
    const newType = Number(newTypeStr) as CustomerType
    setCustomerType(newType)

    if (newType === CustomerType.ConsumidorFinal) {
      setIdentificationType(CustomerIdentificationType.ConsumidorFinal)
      setDocType('CONSUMIDOR_FINAL')
      if (!taxId.trim() || taxId === '9999999999999') {
        setTaxId('9999999999999')
      }
    } else if (newType === CustomerType.PersonaNatural) {
      if (identificationType === CustomerIdentificationType.Ruc) {
        setIdentificationType(CustomerIdentificationType.Cedula)
        setDocType('CEDULA')
      }
    } else if (
      newType === CustomerType.CorporativoB2B ||
      newType === CustomerType.DistribuidorMayorista ||
      newType === CustomerType.InstitucionPublica
    ) {
      if (identificationType === CustomerIdentificationType.ConsumidorFinal) {
        setIdentificationType(CustomerIdentificationType.Ruc)
        setDocType('RUC')
        if (taxId === '9999999999999') setTaxId('')
      }
    }
  }

  const handleIdentificationTypeChange = (newIdTypeStr: string) => {
    const newIdType = Number(newIdTypeStr) as CustomerIdentificationType
    setIdentificationType(newIdType)
    switch (newIdType) {
      case CustomerIdentificationType.Ruc:
        setDocType('RUC')
        break
      case CustomerIdentificationType.Cedula:
        setDocType('CEDULA')
        break
      case CustomerIdentificationType.Pasaporte:
        setDocType('PASAPORTE')
        break
      case CustomerIdentificationType.ConsumidorFinal:
        setDocType('CONSUMIDOR_FINAL')
        if (!taxId.trim()) setTaxId('9999999999999')
        break
    }
  }

  // Manejo de Modal
  const handleOpenCreate = () => {
    setEditingCustomer(null)
    setCustomerType(defaultCustomerType)
    setIdentificationType(CustomerIdentificationType.Ruc)
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

  const handleOpenEdit = (customer: CustomerDto) => {
    setEditingCustomer(customer)
    setCustomerType(customer.customerType ?? CustomerType.CorporativoB2B)
    setIdentificationType(customer.identificationType ?? CustomerIdentificationType.Ruc)
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
        customerType,
        identificationType,
        contactPerson: contactPerson.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        isActive,
      }

      if (editingCustomer) {
        const updated = await updateCustomer(tenantId, editingCustomer.id, payload)
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        toast.show({
          title: 'Cliente actualizado',
          message: `Los datos del cliente "${updated.name}" se guardaron correctamente.`,
          variant: 'success',
        })
      } else {
        const created = await createCustomer(tenantId, payload)
        setCustomers((prev) => [created, ...prev])
        toast.show({
          title: 'Cliente registrado',
          message: `El cliente "${created.name}" fue creado exitosamente con clasificación "${resolveCustomerTypeMeta(created.customerType, customerTypes).shortLabel}".`,
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

  const handleToggleStatus = async (customer: CustomerDto) => {
    if (!tenantId) return
    const newStatus = !customer.isActive
    try {
      const updated = await toggleCustomerStatus(tenantId, customer.id, newStatus)
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

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter === 'active' && !c.isActive) return false
      if (statusFilter === 'inactive' && c.isActive) return false
      if (typeFilter !== 'all' && String(c.customerType) !== typeFilter) return false
      if (c.createdAt && !isoInstantInRange(c.createdAt, { from, to })) return false
      return true
    })
  }, [customers, statusFilter, typeFilter, from, to])

  const activeTypeOptions = useMemo(() => {
    const active = customerTypes.filter((t) => t.isActive)
    const source = active.length > 0 ? active : customerTypes
    return source.map((t) => ({
      value: String(t.code),
      label: t.name,
      shortLabel: t.shortLabel,
    }))
  }, [customerTypes])

  const formTypeOptions = useMemo(() => {
    const opts = [...activeTypeOptions]
    if (!editingCustomer) return opts
    const code = String(editingCustomer.customerType)
    if (opts.some((o) => o.value === code)) return opts
    const meta = resolveCustomerTypeMeta(editingCustomer.customerType, customerTypes)
    return [{ value: code, label: `${meta.label} (inactivo)`, shortLabel: meta.shortLabel }, ...opts]
  }, [activeTypeOptions, customerTypes, editingCustomer])

  const typeFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos los tipos' },
      ...customerTypes.map((t) => ({ value: String(t.code), label: t.shortLabel })),
    ],
    [customerTypes]
  )

  const defaultCustomerType = useMemo(() => {
    const preferred = customerTypes.find(
      (t) => t.isActive && t.code === CustomerType.CorporativoB2B
    )
    if (preferred) return preferred.code as CustomerType
    const firstActive = customerTypes.find((t) => t.isActive)
    return (firstActive?.code ?? CustomerType.CorporativoB2B) as CustomerType
  }, [customerTypes])

  const stats = useMemo(() => {
    const total = customers.length
    const active = customers.filter((c) => c.isActive).length
    const inactive = total - active
    const corporativos = customers.filter(
      (c) => c.customerType === CustomerType.CorporativoB2B || !c.customerType
    ).length
    const personas = customers.filter((c) => c.customerType === CustomerType.PersonaNatural).length
    const withTaxId = customers.filter((c) => Boolean(c.taxId && c.taxId.trim())).length
    return { total, active, inactive, corporativos, personas, withTaxId }
  }, [customers])

  // Paginación y mensajes DataGrid
  const messages = useMemo(() => createSpanishDataGridMessages('cliente', 'clientes'), [])
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging(10)

  const actionItems = useMemo((): PageActionItem[] => {
    const items: PageActionItem[] = [
      {
        id: 'refresh',
        label: 'Actualizar',
        icon: 'refresh-cw',
        disabled: loading,
      },
      {
        id: 'types',
        label: 'Tipos de cliente',
        icon: 'tags',
        route: '/clientes/tipos',
        disabled: false,
      },
    ]
    if (canReadBatches) {
      items.push({
        id: 'batches',
        label: 'Lotes de taller',
        icon: 'layers',
        route: '/taller/lotes',
        disabled: false,
      })
    }
    return items
  }, [canReadBatches, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void loadCustomers()
      }
    },
    [loadCustomers]
  )

  // Columnas DataGrid
  const columns = useMemo(
    (): ColumnDef<CustomerRow>[] => [
      {
        key: 'name',
        header: 'Razón Social / Cliente',
        width: 260,
        sortable: true,
        renderCell: (_v, row: CustomerRow) => (
          <div className="flex flex-col py-1">
            <div className="flex items-center gap-2">
              {row.customerType === CustomerType.PersonaNatural ? (
                <User size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
              ) : (
                <Building2 size={16} className="text-primary/70 shrink-0" aria-hidden />
              )}
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
        key: 'customerType',
        header: 'Clasificación',
        width: 170,
        sortable: true,
        renderCell: (_v, row: CustomerRow) => {
          const type = row.customerType ?? CustomerType.CorporativoB2B
          const meta = resolveCustomerTypeMeta(type, customerTypes)
          return (
            <StatusBadge tone={meta.tone} withDot>
              {meta.shortLabel}
            </StatusBadge>
          )
        },
      },
      {
        key: 'taxId',
        header: 'Identificación / SRI',
        width: 180,
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
        width: 220,
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
        header: 'Ubicación',
        width: 180,
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
        key: 'createdAt',
        header: 'Fecha Registro',
        width: 130,
        sortable: true,
        renderCell: (_v, row: CustomerRow) => (
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {row.createdAt ? formatDate(row.createdAt) : '—'}
          </span>
        ),
      },
      {
        key: 'isActive',
        header: 'Estado',
        width: 100,
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
        width: canReadBatches || canImportBatches ? 170 : 110,
        sortable: false,
        renderCell: (_v, row: CustomerRow) => (
          <div className="flex items-center gap-1.5 py-1">
            {canManage && (
              <>
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
              </>
            )}
            {canReadBatches && (
              <GridIconButton
                label="Ver Lotes de Reparación"
                icon={Layers}
                onClick={() => navigate(`/taller/lotes?clienteId=${row.id}`)}
              />
            )}
            {canImportBatches && (
              <GridIconButton
                label="Importar Lote para este Cliente"
                icon={FilePlus}
                onClick={() => navigate(`/taller/lotes/nuevo?clienteId=${row.id}`)}
              />
            )}
          </div>
        ),
      },
    ],
    [canImportBatches, canManage, canReadBatches, customerTypes, navigate]
  )

  if (!canRead) {
    return (
      <TenantSessionGate
        title="Directorio de Clientes"
        lead="Gestión y clasificación comercial de clientes."
      >
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso customers.read para consultar el directorio de clientes."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Directorio de Clientes"
      lead="Gestión y clasificación comercial de clientes, fabricantes aliados y personas naturales con validación SRI."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Directorio de Clientes"
          subtitle="Clasificación comercial, empresas aliadas y clientes corporativos con validación oficial de cédula y RUC."
          badge={
            <StatusBadge tone="primary" withDot>
              {customers.length} {customers.length === 1 ? 'Cliente registrado' : 'Clientes registrados'}
            </StatusBadge>
          }
          actions={
            <>
              {canManage && (
                <Button type="button" variant="primary" onClick={handleOpenCreate}>
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Nuevo Cliente
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de clientes"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Métricas del directorio de clientes">
          <StatCard
            label="Total Clientes"
            value={stats.total}
            icon="group"
            toneColor="#4f46e5"
            footerText="En la empresa activa"
          />
          <StatCard
            label="Clientes Activos"
            value={stats.active}
            icon="verified"
            toneColor="#10b981"
            footerText="Operativos para transacciones"
          />
          <StatCard
            label="Corporativos B2B"
            value={stats.corporativos}
            icon="domain"
            toneColor="#6366f1"
            footerText="Marcas y fabricantes aliados"
          />
          <StatCard
            label="Personas Naturales"
            value={stats.personas}
            icon="person"
            toneColor="#0284c7"
            footerText="Clientes finales y particulares"
          />
        </div>

        <SectionCard
          title="Cartera y Directorio"
          subtitle={
            statusFilter === 'active'
              ? 'Clientes habilitados para operaciones comerciales y de taller'
              : statusFilter === 'inactive'
                ? 'Clientes desactivados; no participan en nuevas operaciones'
                : 'Consulta, segmentación por tipo y mantenimiento de la cartera'
          }
          action={
            <div className="flex items-center gap-2">
              <Select
                id="filter-customers-status"
                label="Mostrar"
                width="220px"
                labelPosition="outlined"
                variant="outline"
                options={[
                  { value: 'active', label: `Activos (${stats.active})` },
                  { value: 'all', label: `Todos (${stats.total})` },
                  { value: 'inactive', label: `Inactivos (${stats.inactive})` },
                ]}
                value={statusFilter}
                onChange={(val: string) => setStatusFilter(val as 'all' | 'active' | 'inactive')}
              />
            </div>
          }
        >
          {error && (
            <div className="ecu-form-error-banner mb-4" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {filteredCustomers.length === 0 && !loading ? (
            customers.length === 0 ? (
              <EmptyState
                icon="group"
                title="No hay clientes registrados en este momento"
                description="Registra clientes corporativos, talleres o personas naturales con validación tributaria para utilizarlos en lotes de reparación, facturación y operaciones del sistema."
                action={
                  canManage ? (
                    <Button type="button" variant="primary" onClick={handleOpenCreate}>
                      <Plus size={16} strokeWidth={2} aria-hidden />
                      Registrar Primer Cliente
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <EmptyState
                icon="filter"
                title="No se encontraron clientes con los filtros seleccionados"
                description="Ajusta el estado, la clasificación o el rango de fechas para ampliar la búsqueda en el directorio."
                action={
                  <Button type="button" variant="outline" onClick={() => setStatusFilter('all')}>
                    Ver Todos los Clientes ({stats.total})
                  </Button>
                }
              />
            )
          ) : (
            <DataGrid
              className="ecu-customers-grid"
              dataSource={filteredCustomers as CustomerRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={300}
              searchPlaceholder="Buscar por razón social, RUC o contacto..."
              toolbarRight={
                <div className="flex flex-wrap items-center gap-2">
                  <div style={{ minWidth: 180 }}>
                    <Select
                      id="filter-customers-type"
                      aria-label="Filtrar por clasificación de cliente"
                      variant="outline"
                      options={typeFilterOptions}
                      value={typeFilter}
                      onChange={(val: string) => setTypeFilter(val)}
                    />
                  </div>
                  <GridDateRangeBox
                    from={from}
                    to={to}
                    lookback={lookback}
                    disabled={loading}
                    onChange={setRange}
                  />
                </div>
              }
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
          title={editingCustomer ? 'Editar Ficha de Cliente' : 'Registrar Nuevo Cliente'}
          onClose={handleCloseModal}
          width="min(94vw, 48rem)"
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
          <form onSubmit={handleSaveCustomer} className="ecu-customer-form" noValidate>
            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <div className="ecu-customer-form__grid">
              <div className="ecu-customer-form__field ecu-customer-form__field--span">
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
                  placeholder="Nombre o razón social"
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div className="ecu-customer-form__field">
                <Select
                  id="customer-type-select"
                  label="Clasificación de Cliente"
                  labelPosition="outlined"
                  variant="outline"
                  value={String(customerType)}
                  onChange={handleCustomerTypeChange}
                  options={formTypeOptions}
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div className="ecu-customer-form__field">
                <Select
                  id="customer-doc-type"
                  label="Tipo de Identificación"
                  labelPosition="outlined"
                  variant="outline"
                  value={String(identificationType)}
                  onChange={handleIdentificationTypeChange}
                  options={[
                    {
                      value: String(CustomerIdentificationType.Ruc),
                      label: CUSTOMER_IDENTIFICATION_LABELS[CustomerIdentificationType.Ruc],
                    },
                    {
                      value: String(CustomerIdentificationType.Cedula),
                      label: CUSTOMER_IDENTIFICATION_LABELS[CustomerIdentificationType.Cedula],
                    },
                    {
                      value: String(CustomerIdentificationType.Pasaporte),
                      label: CUSTOMER_IDENTIFICATION_LABELS[CustomerIdentificationType.Pasaporte],
                    },
                    {
                      value: String(CustomerIdentificationType.ConsumidorFinal),
                      label: CUSTOMER_IDENTIFICATION_LABELS[CustomerIdentificationType.ConsumidorFinal],
                    },
                  ]}
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div className="ecu-customer-form__field">
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
                  placeholder={
                    identificationType === CustomerIdentificationType.Cedula
                      ? '10 dígitos'
                      : identificationType === CustomerIdentificationType.ConsumidorFinal
                        ? '9999999999999'
                        : '13 dígitos'
                  }
                  fullWidth
                  disabled={saving}
                />
                {taxId.trim() && taxIdValidation ? (
                  <span
                    className={`ecu-customer-form__hint ${
                      taxIdValidation.isValid
                        ? 'ecu-customer-form__hint--ok'
                        : 'ecu-customer-form__hint--error'
                    }`}
                  >
                    {taxIdValidation.isValid ? taxIdValidation.label : taxIdValidation.error}
                  </span>
                ) : null}
              </div>

              <div className="ecu-customer-form__field">
                <TextBox
                  id="customer-person"
                  label="Persona o Ejecutivo de Contacto"
                  labelPosition="outlined"
                  variant="outline"
                  value={contactPerson}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setContactPerson(e.target.value)}
                  placeholder="Nombre del contacto"
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div className="ecu-customer-form__field">
                <TextBox
                  id="customer-email"
                  label="Correo Electrónico"
                  labelPosition="outlined"
                  variant="outline"
                  type="email"
                  value={contactEmail}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setContactEmail(e.target.value)
                    if (formError) setFormError(null)
                  }}
                  placeholder="correo@empresa.com"
                  fullWidth
                  disabled={saving}
                />
                {contactEmail.trim() && !emailValidation.isValid ? (
                  <span className="ecu-customer-form__hint ecu-customer-form__hint--error">
                    {emailValidation.error}
                  </span>
                ) : null}
              </div>

              <div className="ecu-customer-form__field">
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
                  placeholder="0991234567"
                  fullWidth
                  disabled={saving}
                />
                {contactPhone.trim() && !phoneValidation.isValid ? (
                  <span className="ecu-customer-form__hint ecu-customer-form__hint--error">
                    {phoneValidation.error}
                  </span>
                ) : null}
              </div>

              <div className="ecu-customer-form__field ecu-customer-form__field--span">
                <TextBox
                  id="customer-address"
                  label="Dirección Física o Planta"
                  labelPosition="outlined"
                  variant="outline"
                  value={address}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
                  placeholder="Dirección"
                  fullWidth
                  disabled={saving}
                />
              </div>

              <div className="ecu-customer-form__field ecu-customer-form__field--span">
                <TextArea
                  id="customer-notes"
                  label="Notas y Condiciones Particulares"
                  labelPosition="outlined"
                  variant="outline"
                  rows={3}
                  value={notes}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  placeholder="Opcional"
                  fullWidth
                  disabled={saving}
                />
              </div>
            </div>

            <div className="ecu-customer-form__status">
              <CheckButton
                checked={isActive}
                onChange={(checked: boolean) => setIsActive(checked)}
                disabled={saving}
              >
                Cliente habilitado para operaciones
              </CheckButton>
            </div>
          </form>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}

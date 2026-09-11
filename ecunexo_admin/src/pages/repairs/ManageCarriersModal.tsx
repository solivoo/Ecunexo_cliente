import { useState, useEffect, type ChangeEvent } from 'react'
import { Button, Popup, TextBox, useToast } from 'glubox'
import { Plus, Trash2, Truck, Check, Edit2 } from 'lucide-react'
import {
  getTenantCarriers,
  saveTenantCarrier,
  deleteTenantCarrier,
  type TransportCarrier,
} from '@/services/carrierStorage'

export type ManageCarriersModalProps = {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  onSelectCarrier?: (carrier: TransportCarrier) => void
  selectedCarrierId?: string | null
}

export function ManageCarriersModal({
  isOpen,
  onClose,
  tenantId,
  onSelectCarrier,
  selectedCarrierId,
}: ManageCarriersModalProps) {
  const toast = useToast()
  const [carriers, setCarriers] = useState<TransportCarrier[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formName, setFormName] = useState('')
  const [formDoc, setFormDoc] = useState('')
  const [formPlate, setFormPlate] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    if (isOpen && tenantId) {
      setCarriers(getTenantCarriers(tenantId))
      resetForm()
    }
  }, [isOpen, tenantId])

  const resetForm = () => {
    setIsEditing(false)
    setEditingId(null)
    setFormName('')
    setFormDoc('')
    setFormPlate('')
    setFormPhone('')
    setFormNotes('')
  }

  const handleStartCreate = () => {
    resetForm()
    setIsEditing(true)
  }

  const handleStartEdit = (carrier: TransportCarrier) => {
    setEditingId(carrier.id)
    setFormName(carrier.name)
    setFormDoc(carrier.document)
    setFormPlate(carrier.vehiclePlate)
    setFormPhone(carrier.phone || '')
    setFormNotes(carrier.notes || '')
    setIsEditing(true)
  }

  const handleSave = () => {
    if (!formName.trim()) {
      toast.show({
        title: 'Campo requerido',
        message: 'El nombre o razón social del transportista es obligatorio.',
        variant: 'error',
      })
      return
    }

    const saved = saveTenantCarrier(tenantId, {
      id: editingId || undefined,
      name: formName,
      document: formDoc,
      vehiclePlate: formPlate,
      phone: formPhone,
      notes: formNotes,
    })

    const updated = getTenantCarriers(tenantId)
    setCarriers(updated)
    toast.show({
      title: editingId ? 'Operador actualizado' : 'Operador registrado',
      message: `${saved.name} ha sido guardado exitosamente.`,
      variant: 'success',
    })

    if (onSelectCarrier) {
      onSelectCarrier(saved)
      onClose()
    } else {
      resetForm()
    }
  }

  const handleDelete = (id: string, name: string) => {
    deleteTenantCarrier(tenantId, id)
    setCarriers(getTenantCarriers(tenantId))
    toast.show({
      title: 'Operador eliminado',
      message: `${name} fue retirado del directorio.`,
      variant: 'info',
    })
  }

  return (
    <Popup
      open={isOpen}
      onClose={onClose}
      title="Directorio de Operadores de Transporte"
      width={640}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
        <p className="ecu-modal-section-lead" style={{ margin: 0 }}>
          Registra y administra los operadores de transporte, transportistas y empresas logísticas autorizadas para retirar equipos de taller.
        </p>

        {isEditing ? (
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--shell-border)',
              backgroundColor: 'var(--glb-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.925rem', color: 'var(--glb-text)' }}>
                {editingId ? 'Editar operador de transporte' : 'Nuevo operador de transporte'}
              </strong>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
            </div>

            <div className="ecu-modal-form__grid">
              <TextBox
                id="carrier-form-name"
                label="Nombre / Razón Social *"
                labelPosition="outlined"
                variant="outline"
                value={formName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                placeholder="ej. Servientrega Express / Carlos Pérez"
                fullWidth
                required
              />
              <TextBox
                id="carrier-form-doc"
                label="Cédula / RUC *"
                labelPosition="outlined"
                variant="outline"
                value={formDoc}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormDoc(e.target.value)}
                placeholder="ej. 1718293847 o 1791234567001"
                fullWidth
              />
            </div>

            <div className="ecu-modal-form__grid">
              <TextBox
                id="carrier-form-plate"
                label="Placa de Vehículo"
                labelPosition="outlined"
                variant="outline"
                value={formPlate}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormPlate(e.target.value)}
                placeholder="ej. PCX-7821"
                fullWidth
              />
              <TextBox
                id="carrier-form-phone"
                label="Teléfono de Contacto"
                labelPosition="outlined"
                variant="outline"
                value={formPhone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormPhone(e.target.value)}
                placeholder="ej. 0991234567"
                fullWidth
              />
            </div>

            <TextBox
              id="carrier-form-notes"
              label="Notas / Tipo de Transporte"
              labelPosition="outlined"
              variant="outline"
              value={formNotes}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormNotes(e.target.value)}
              placeholder="ej. Operador logístico, courier provincial, retiro comisionado..."
              fullWidth
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                Descartar
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleSave}>
                {editingId ? 'Guardar Cambios' : 'Guardar y Usar'}
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="button" variant="primary" size="sm" onClick={handleStartCreate}>
              <Plus size={15} strokeWidth={2} aria-hidden />
              + Registrar nuevo operador
            </Button>
          </div>
        )}

        {/* Lista de transportistas guardados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {carriers.length === 0 ? (
            <div
              style={{
                padding: '1.5rem',
                textAlign: 'center',
                color: 'var(--glb-muted)',
                borderRadius: '8px',
                border: '1px dashed var(--shell-border)',
              }}
            >
              No hay transportistas registrados. Agrega uno nuevo arriba.
            </div>
          ) : (
            carriers.map((c) => {
              const isSelected = selectedCarrierId === c.id
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: isSelected
                      ? '1.5px solid var(--shell-primary)'
                      : '1px solid var(--shell-border)',
                    backgroundColor: isSelected
                      ? 'rgba(var(--shell-primary-rgb, 14, 165, 233), 0.05)'
                      : 'var(--glb-surface)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '6px',
                        backgroundColor: 'var(--glb-hover, rgba(0,0,0,0.04))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--shell-primary)',
                      }}
                    >
                      <Truck size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--glb-text)' }}>
                          {c.name}
                        </strong>
                        {c.vehiclePlate && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'ui-monospace, monospace',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--glb-app-bg, #f1f5f9)',
                              border: '1px solid var(--shell-border)',
                              fontWeight: 600,
                            }}
                          >
                            {c.vehiclePlate}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.785rem', color: 'var(--glb-muted)', marginTop: '2px' }}>
                        {c.document ? `Doc: ${c.document}` : 'Sin documento registrado'}
                        {c.phone ? ` · Tel: ${c.phone}` : ''}
                        {c.notes ? ` · ${c.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {onSelectCarrier && (
                      <Button
                        type="button"
                        variant={isSelected ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => {
                          onSelectCarrier(c)
                          onClose()
                        }}
                      >
                        <Check size={14} strokeWidth={2} aria-hidden />
                        {isSelected ? 'Seleccionado' : 'Elegir'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(c)}
                      aria-label={`Editar ${c.name}`}
                    >
                      <Edit2 size={14} strokeWidth={1.8} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(c.id, c.name)}
                      aria-label={`Eliminar ${c.name}`}
                    >
                      <Trash2 size={14} strokeWidth={1.8} style={{ color: 'var(--glb-danger, #ef4444)' }} />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Popup>
  )
}

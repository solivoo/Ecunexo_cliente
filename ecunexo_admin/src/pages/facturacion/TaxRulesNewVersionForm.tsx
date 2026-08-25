import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, CheckButton, DateBox, NumberBox, TextBox } from 'glubox'
import type { CreateTaxRuleBody } from '@/pages/facturacion/taxRuleCatalog'
import { DEFAULT_SRI_VOID_PAYLOAD, todayIso } from '@/pages/facturacion/taxRuleCatalog'

type TaxRulesNewVersionFormProps = {
  readonly disabled: boolean
  readonly busy: boolean
  readonly onSubmit: (body: CreateTaxRuleBody) => void
}

export function TaxRulesNewVersionForm({
  disabled,
  busy,
  onSubmit,
}: TaxRulesNewVersionFormProps) {
  const [validFrom, setValidFrom] = useState(todayIso)
  const [deadlineDay, setDeadlineDay] = useState(
    String(DEFAULT_SRI_VOID_PAYLOAD.deadlineDayOfFollowingMonth)
  )
  const [description, setDescription] = useState('')
  const [extendWeekday, setExtendWeekday] = useState(
    DEFAULT_SRI_VOID_PAYLOAD.extendToNextWeekday
  )
  const [blockVoid, setBlockVoid] = useState(DEFAULT_SRI_VOID_PAYLOAD.consumerFinalCannotVoid)
  const [blockNc, setBlockNc] = useState(DEFAULT_SRI_VOID_PAYLOAD.consumerFinalCannotCreditNote)

  const locked = disabled || busy

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const day = Number.parseInt(deadlineDay, 10)
    onSubmit({
      description:
        description.trim() ||
        `Anulación en línea SRI hasta el día ${Number.isFinite(day) ? day : 7} del mes siguiente.`,
      validFrom,
      deadlineDayOfFollowingMonth: Number.isFinite(day) ? day : 7,
      extendToNextWeekday: extendWeekday,
      consumerFinalCannotVoid: blockVoid,
      consumerFinalCannotCreditNote: blockNc,
    })
  }

  return (
    <div className="tax-rule-kind__form">
      <p className="ecu-companies-form__hint">
        Cuando el SRI publique otra resolución, registra la fecha de vigencia. La actual se cierra
        el día anterior; el historial no se edita.
      </p>
      <form className="ecu-companies-form" onSubmit={handleSubmit}>
        <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
          <div className="ecu-companies-form__field">
            <DateBox
              id="tax-rule-from"
              label="Vigente desde"
              labelPosition="outlined"
              variant="outline"
              size="md"
              value={validFrom}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setValidFrom(e.target.value)}
              disabled={locked}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field">
            <NumberBox
              id="tax-rule-day"
              label="Día límite del mes siguiente"
              labelPosition="outlined"
              variant="outline"
              min={1}
              max={28}
              step={1}
              showSpinButtons
              value={Number(deadlineDay) || 0}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDeadlineDay(e.target.value)}
              placeholder="7"
              disabled={locked}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
            <TextBox
              id="tax-rule-desc"
              label="Descripción"
              labelPosition="outlined"
              variant="outline"
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              placeholder="NAC-DGERCGC… anulación en línea día 15"
              disabled={locked}
              fullWidth
            />
          </div>
          <div className="ecu-companies-form__field sri-config-field--check-align">
            <CheckButton
              variant="ghost"
              checked={extendWeekday}
              onChange={setExtendWeekday}
              disabled={locked}
            >
              Si cae fin de semana, pasa al siguiente hábil
            </CheckButton>
          </div>
          <div className="ecu-companies-form__field sri-config-field--check-align">
            <CheckButton
              variant="ghost"
              checked={blockVoid}
              onChange={setBlockVoid}
              disabled={locked}
            >
              Consumidor final: sin anulación en línea
            </CheckButton>
          </div>
          <div className="ecu-companies-form__field sri-config-field--check-align">
            <CheckButton variant="ghost" checked={blockNc} onChange={setBlockNc} disabled={locked}>
              Consumidor final: sin nota de crédito
            </CheckButton>
          </div>
        </div>
        <footer className="ecu-companies-form__actions">
          <Button type="submit" variant="primary" size="md" disabled={locked} loading={busy}>
            {busy ? 'Guardando…' : 'Registrar vigencia'}
          </Button>
        </footer>
      </form>
    </div>
  )
}

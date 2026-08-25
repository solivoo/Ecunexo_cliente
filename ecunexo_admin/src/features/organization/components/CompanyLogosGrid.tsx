import { useMemo } from 'react'
import { DataGrid, type ColumnDef } from 'glubox'
import { Moon, Sun, Trash2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { resolveAssetUrl } from '@/features/organization/resolveTenantMark'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { formatDateTime } from '@/lib/formatDate'
import type { BrandLogoListItem } from '@/services/brandLogoApi'

export type CompanyLogoRow = BrandLogoListItem & Record<string, unknown>

export function CompanyLogosGrid({
  rows,
  lightLogoId,
  darkLogoId,
  disabled,
  loading = false,
  onUseLight,
  onUseDark,
  onDelete,
}: {
  readonly rows: readonly BrandLogoListItem[]
  readonly lightLogoId: string | null
  readonly darkLogoId: string | null
  readonly disabled?: boolean
  readonly loading?: boolean
  readonly onUseLight: (id: string) => void
  readonly onUseDark: (id: string) => void
  readonly onDelete: (id: string) => void
}) {
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const messages = useMemo(
    () =>
      createSpanishDataGridMessages('logo', 'logos', {
        emptyMessage: 'Aún no hay logos. Sube PNG, JPG, WebP o SVG.',
      }),
    []
  )
  const dataSource = useMemo(
    () => (Array.isArray(rows) ? rows : []) as CompanyLogoRow[],
    [rows]
  )

  const columns = useMemo(
    (): ColumnDef<CompanyLogoRow>[] => [
      {
        key: 'originalFileName',
        header: 'Archivo',
        width: 280,
        sortable: true,
        renderCell: (_value: CompanyLogoRow['originalFileName'], row: CompanyLogoRow) => {
          const src = resolveAssetUrl(row.fileUrl)
          return (
            <div className="company-logos-grid__file">
              {src ? (
                <img src={src} alt="" className="company-logos-grid__thumb" />
              ) : (
                <span className="company-logos-grid__thumb company-logos-grid__thumb--empty" />
              )}
              <div>
                <strong>{row.originalFileName}</strong>
                <p className="company-logos-grid__ext">.{row.extension}</p>
                <p className="company-logos-grid__marks">
                  {lightLogoId === row.id ? <span>Claro</span> : null}
                  {darkLogoId === row.id ? <span>Oscuro</span> : null}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        key: 'byteSize',
        header: 'Peso',
        width: 90,
        sortable: true,
        renderCell: (_value: CompanyLogoRow['byteSize'], row: CompanyLogoRow) =>
          `${Math.max(1, Math.round(row.byteSize / 1024))} KB`,
      },
      {
        key: 'createdAt',
        header: 'Subido',
        width: 160,
        sortable: true,
        renderCell: (_value: CompanyLogoRow['createdAt'], row: CompanyLogoRow) =>
          formatDateTime(row.createdAt),
      },
      {
        key: 'id',
        header: 'Uso',
        width: 148,
        align: 'center',
        sortable: false,
        renderCell: (_value: CompanyLogoRow['id'], row: CompanyLogoRow) => (
          <div className="ecu-companies-grid__actions">
            <GridIconButton
              label={lightLogoId === row.id ? 'Logo claro actual' : 'Usar en claro'}
              icon={Sun}
              active={lightLogoId === row.id}
              disabled={disabled}
              onClick={() => onUseLight(row.id)}
            />
            <GridIconButton
              label={darkLogoId === row.id ? 'Logo oscuro actual' : 'Usar en oscuro'}
              icon={Moon}
              active={darkLogoId === row.id}
              disabled={disabled}
              onClick={() => onUseDark(row.id)}
            />
            <GridIconButton
              label="Eliminar"
              icon={Trash2}
              disabled={disabled}
              onClick={() => onDelete(row.id)}
            />
          </div>
        ),
      },
    ],
    [darkLogoId, disabled, lightLogoId, onDelete, onUseDark, onUseLight]
  )

  return (
    <DataGrid<CompanyLogoRow>
      className="ecu-companies-grid"
      dataSource={dataSource}
      keyExpr="id"
      columns={columns}
      selectionMode="none"
      paging={paging}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      paginationMode="client"
      pageSizeOptions={pageSizeOptions}
      layout="auto"
      cardBreakpoint={720}
      showRowCount
      fullWidth
      loading={loading}
      messages={messages}
      stickyFirstColumn
    />
  )
}

import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Popup, type ColumnDef, type DataGridCardRenderContext } from 'glubox'
import { DollarSign, Eye, EyeOff, Layers, Package, Pencil, Trash2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { firstLevelSummary } from '@/lib/catalogArchetype'
import { catalogItemKindLabel, catalogItemStatusLabel } from '@/lib/catalogLabels'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import {
  CatalogItemKind,
  CatalogItemStatus,
  type CatalogItemListItemDto,
} from '@/types/catalogApi'
import './catalogGrid.css'

export type CatalogItemGridRow = CatalogItemListItemDto & {
  matrixCode?: string
} & Record<string, unknown>

export type CatalogItemsGridProps = {
  readonly rows: CatalogItemListItemDto[]
  readonly loading?: boolean
  readonly canEdit?: boolean
  readonly canDelete?: boolean
  readonly canHide?: boolean
  readonly canAssignPrice?: boolean
  readonly deletingId?: string | null
  readonly hidingId?: string | null
  readonly onDelete?: (row: CatalogItemListItemDto) => void
  readonly onToggleHidden?: (row: CatalogItemListItemDto) => void
  readonly toolbarRight?: ReactNode
}


function CatalogKindMark({ kind }: { readonly kind: CatalogItemListItemDto['kind'] }) {
  const isPhysical = kind === CatalogItemKind.Physical
  return (
    <span className={`ecu-kind ${isPhysical ? 'ecu-kind--physical' : 'ecu-kind--service'}`}>
      <span className="ecu-kind__mark" aria-hidden />
      {catalogItemKindLabel(kind)}
    </span>
  )
}

function CatalogStatusMark({ status }: { readonly status: CatalogItemListItemDto['status'] }) {
  const isActive = status === CatalogItemStatus.Active
  return (
    <span className={`ecu-status ${isActive ? 'ecu-status--active' : 'ecu-status--inactive'}`}>
      <span className="ecu-status__dot" aria-hidden />
      {catalogItemStatusLabel(status)}
    </span>
  )
}

function matrixIdOf(row: CatalogItemListItemDto): string | null {
  return row.isMatrixParent ? row.id : row.parentId ?? null
}

function matrixCode(matrixId: string): string {
  return `M-${matrixId.replace(/-/g, '').slice(-6).toUpperCase()}`
}

function CatalogMissingCategoryMark() {
  return (
    <span className="ecu-chip ecu-chip--warning" title="Sin categoría: no entra en reglas de precio por categoría">
      Sin categoría
    </span>
  )
}

function CatalogHiddenMark() {
  return (
    <span className="ecu-chip ecu-chip--warning" title="No se muestra en la tienda online">
      <EyeOff size={12} aria-hidden />
      Oculto en tienda
    </span>
  )
}

function CatalogVariantNote({ count }: { readonly count: number }) {
  return (
    <span className="ecu-variant-note">
      <Layers size={13} aria-hidden />
      Variantes ({count})
    </span>
  )
}

function resolveDisplayItemName(row: CatalogItemListItemDto): string {
  const raw = (row.name ?? '').trim()
  if (!row.isMatrixParent) return raw || 'Producto'
  const isGeneric =
    !raw ||
    raw.toLowerCase() === 'matriz' ||
    raw.toLowerCase() === 'producto' ||
    (row.familyName && raw.toLowerCase() === row.familyName.trim().toLowerCase())
  return isGeneric ? 'Producto matriz' : raw
}

function resolveCatalogItemThumbUrl(row: CatalogItemGridRow): string | null {
  const raw = row.mainImageThumbUrl || (row as { mainImageUrl?: string | null }).mainImageUrl
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Si la URL apunta a una variante grande o mediana, asegurar la variante pequeña (_thumb) del bucket
  if (trimmed.includes('_large.webp')) {
    return trimmed.replace('_large.webp', '_thumb.webp')
  }
  if (trimmed.includes('_medium.webp')) {
    return trimmed.replace('_medium.webp', '_thumb.webp')
  }
  return trimmed
}

function resolveCatalogItemPreviewUrl(row: CatalogItemListItemDto): string | null {
  const raw = row.mainImageUrl?.trim() || row.mainImageThumbUrl?.trim()
  if (!raw) return null
  return raw.includes('_thumb.webp') ? raw.replace('_thumb.webp', '_medium.webp') : raw
}

function CatalogItemGridThumb({
  row,
  onPreview,
}: {
  readonly row: CatalogItemGridRow
  readonly onPreview: (row: CatalogItemGridRow) => void
}) {
  const [hasError, setHasError] = useState(false)
  const thumbUrl = resolveCatalogItemThumbUrl(row)

  if (!thumbUrl || hasError) {
    return (
      <div
        className="catalog-item-thumb"
        title={row.name}
        aria-label={row.name}
        style={{
          width: 36,
          height: 36,
          minWidth: 36,
          maxWidth: 36,
          minHeight: 36,
          maxHeight: 36,
        }}
      >
        <Package size={16} />
      </div>
    )
  }

  return (
    <button
      type="button"
      className="ecu-thumb-preview-trigger"
      title={`Ver imagen de ${row.name}`}
      aria-label={`Ver imagen de ${row.name}`}
      onClick={(e) => {
        e.stopPropagation()
        onPreview(row)
      }}
    >
      <img
        src={thumbUrl}
        alt=""
        className="catalog-item-thumb"
        loading="lazy"
        onError={() => setHasError(true)}
        style={{
          width: 36,
          height: 36,
          minWidth: 36,
          maxWidth: 36,
          minHeight: 36,
          maxHeight: 36,
          objectFit: 'cover',
        }}
      />
    </button>
  )
}

function CatalogItemCardThumb({ row }: { readonly row: CatalogItemGridRow }) {
  const [hasError, setHasError] = useState(false)
  const thumbUrl = resolveCatalogItemThumbUrl(row)

  if (!thumbUrl || hasError) {
    return (
      <div
        className="ecu-catalog-card__thumb ecu-catalog-card__thumb--empty"
        title={row.name}
        aria-label={row.name}
      >
        <Package size={24} />
      </div>
    )
  }

  return (
    <img
      src={thumbUrl}
      alt={row.name}
      className="ecu-catalog-card__thumb"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

const gridMessages = createSpanishDataGridMessages('ítem', 'ítems')

export function CatalogItemsGrid({
  rows,
  loading = false,
  canEdit = false,
  canDelete = false,
  canHide = false,
  canAssignPrice = false,
  deletingId = null,
  hidingId = null,
  onDelete,
  onToggleHidden,
  toolbarRight,
}: CatalogItemsGridProps) {
  const navigate = useNavigate()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const [previewRow, setPreviewRow] = useState<CatalogItemGridRow | null>(null)
  const previewUrl = previewRow ? resolveCatalogItemPreviewUrl(previewRow) : null

  const skuCountByMatrix = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      if (row.isMatrixParent || !row.parentId) continue
      counts.set(row.parentId, (counts.get(row.parentId) ?? 0) + 1)
    }
    return counts
  }, [rows])

  const gridRows = useMemo(
    () =>
      rows.map((row) => {
        const matrixId = matrixIdOf(row)
        return { ...row, matrixCode: matrixId ? matrixCode(matrixId) : '' } as CatalogItemGridRow
      }),
    [rows]
  )

  const columns = useMemo((): ColumnDef<CatalogItemGridRow>[] => {
    const cols: ColumnDef<CatalogItemGridRow>[] = [
      {
        key: 'mainImageThumbUrl',
        header: 'FOTO',
        align: 'center',
        width: 68,
        sortable: false,
        renderCell: (_value: unknown, row: CatalogItemGridRow) => (
          <CatalogItemGridThumb row={row} onPreview={setPreviewRow} />
        ),
      },
      {
        key: 'sku',
        header: 'SKU',
        width: 110,
        sortable: false,
        renderCell: (_value: CatalogItemGridRow['sku'], row: CatalogItemGridRow) => {
          if (row.isMatrixParent) {
            return (
              <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                Por variante
              </span>
            )
          }
          return row.sku ? <code className="ecu-code">{row.sku}</code> : '—'
        },
      },
      {
        key: 'name',
        header: 'NOMBRE',
        width: 240,
        renderCell: (_value: CatalogItemGridRow['name'], row: CatalogItemGridRow) => {
          const levelSummary = firstLevelSummary(row.hierarchyPathJson)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <strong>{resolveDisplayItemName(row)}</strong>
              {row.description ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                  {row.description}
                </span>
              ) : null}
              {levelSummary ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted)' }}>
                  {levelSummary}
                </span>
              ) : null}
              {row.isHiddenFromStorefront ? <CatalogHiddenMark /> : null}
              {row.isMatrixParent ? <CatalogVariantNote count={row.variantCount ?? 0} /> : null}
            </div>
          )
        },
      },
      {
        key: 'categoryName',
        header: 'CATEGORÍA',
        width: 140,
        renderCell: (_value: CatalogItemGridRow['categoryName'], row: CatalogItemGridRow) =>
          row.categoryName ? row.categoryName : <CatalogMissingCategoryMark />,
      },
      {
        key: 'matrixCode',
        header: 'MATRIZ',
        width: 120,
        renderCell: (_value: unknown, row: CatalogItemGridRow) => {
          const matrixId = matrixIdOf(row)
          if (!matrixId) {
            return <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Individual</span>
          }
          const skuCount = row.isMatrixParent
            ? row.variantCount ?? 0
            : skuCountByMatrix.get(matrixId) ?? 1
          const code = <code className="ecu-code">{matrixCode(matrixId)}</code>
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {canEdit ? (
                <button
                  type="button"
                  className="ecu-matrix-link"
                  title={`Abrir producto padre (matriz) · ${matrixId}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/catalogo/items/${matrixId}`)
                  }}
                >
                  {code}
                </button>
              ) : (
                <span title={matrixId}>{code}</span>
              )}
              <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted)' }}>
                {skuCount} {skuCount === 1 ? 'SKU' : 'SKUs'}
              </span>
            </div>
          )
        },
      },
      {
        key: 'kind',
        header: 'TIPO',
        align: 'center',
        width: 110,
        sortable: false,
        renderCell: (_value: CatalogItemGridRow['kind'], row: CatalogItemGridRow) => (
          <CatalogKindMark kind={row.kind} />
        ),
      },
      {
        key: 'status',
        header: 'ESTADO',
        align: 'center',
        width: 110,
        renderCell: (_value: CatalogItemGridRow['status'], row: CatalogItemGridRow) => (
          <CatalogStatusMark status={row.status} />
        ),
      },
      {
        key: 'createdAt',
        header: 'ALTA',
        align: 'center',
        width: 110,
        sortable: false,
        renderCell: (_value: CatalogItemGridRow['createdAt'], row: CatalogItemGridRow) =>
          formatDate(row.createdAt),
      },
    ]

     if (canEdit || canDelete || canHide) {
      cols.push({
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: (canHide ? 150 : canDelete ? 112 : 72) + (canAssignPrice ? 36 : 0),
        align: 'center',
        sortable: false,
        renderCell: (_value: CatalogItemGridRow['id'], row: CatalogItemGridRow) => (
          <div className="ecu-companies-grid__actions">
            {canAssignPrice ? (
              <GridIconButton
                label="Asignar precio"
                icon={DollarSign}
                onClick={() =>
                  navigate(`/catalogo/precios/productos/nuevo?catalogItemId=${row.id}`)
                }
              />
            ) : null}
            {canEdit ? (
              <GridIconButton
                label="Editar"
                icon={Pencil}
                onClick={() => navigate(`/catalogo/items/${row.id}`)}
              />
            ) : null}
            {canHide && onToggleHidden ? (
              <GridIconButton
                label={row.isHiddenFromStorefront ? 'Mostrar en la tienda' : 'Ocultar en la tienda'}
                icon={row.isHiddenFromStorefront ? Eye : EyeOff}
                disabled={hidingId === row.id}
                loading={hidingId === row.id}
                onClick={() => onToggleHidden(row)}
              />
            ) : null}
            {canDelete && onDelete ? (
              <GridIconButton
                label="Eliminar"
                icon={Trash2}
                danger
                disabled={deletingId === row.id}
                loading={deletingId === row.id}
                onClick={() => onDelete(row)}
              />
            ) : null}
          </div>
        ),
      })
    }


    return cols
  }, [
    canAssignPrice,
    canDelete,
    canEdit,
    canHide,
    deletingId,
    hidingId,
    navigate,
    onDelete,
    onToggleHidden,
    skuCountByMatrix,
  ])

  const renderCard = useMemo(() => {
    return ({ row }: DataGridCardRenderContext<CatalogItemGridRow>) => (
      <div className="ecu-catalog-card">
        <div className="ecu-catalog-card__header">
          <div className="ecu-catalog-card__thumb-wrap">
            <CatalogItemCardThumb row={row} />
          </div>
          <div className="ecu-catalog-card__header-main">
            <div className="ecu-catalog-card__meta-badges">
              <CatalogStatusMark status={row.status} />
              {row.isHiddenFromStorefront ? <CatalogHiddenMark /> : null}
            </div>

            <h4
              className="ecu-catalog-card__title"
              title={row.isMatrixParent ? resolveDisplayItemName(row) : row.name}
            >
              {resolveDisplayItemName(row)}
            </h4>

            {row.isMatrixParent ? (
              <div style={{ margin: '2px 0 6px 0' }}>
                <CatalogVariantNote count={row.variantCount ?? 0} />
              </div>
            ) : null}

            <div className="ecu-catalog-card__tags">
              {!row.isMatrixParent && row.sku ? (
                <span className="ecu-catalog-card__sku">
                  <span className="ecu-catalog-card__sku-label">SKU:</span>
                  <code className="ecu-code">{row.sku}</code>
                </span>
              ) : null}
              <CatalogKindMark kind={row.kind} />
              {row.categoryName ? (
                <span className="ecu-catalog-card__sku">{row.categoryName}</span>
              ) : (
                <CatalogMissingCategoryMark />
              )}
            </div>
          </div>
        </div>

        <div className="ecu-catalog-card__body">

          {(canEdit || canDelete || canHide || canAssignPrice) && (
            <div className="ecu-catalog-card__actions">
              {canAssignPrice ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/catalogo/precios/productos/nuevo?catalogItemId=${row.id}`)
                  }}
                  aria-label={`Asignar precio a ${row.name}`}
                  title="Asignar precio"
                >
                  <DollarSign size={15} />
                  <span>Precio</span>
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ecu-catalog-card__btn-edit"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/catalogo/items/${row.id}`)
                  }}
                  aria-label={`Editar ${row.name}`}
                  title="Editar ítem"
                >
                  <Pencil size={15} />
                  <span>Editar</span>
                </Button>
              ) : null}
              {canHide && onToggleHidden ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ecu-catalog-card__btn-hide"
                  disabled={hidingId === row.id}
                  loading={hidingId === row.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleHidden(row)
                  }}
                  aria-label={
                    row.isHiddenFromStorefront
                      ? `Mostrar ${row.name} en la tienda`
                      : `Ocultar ${row.name} en la tienda`
                  }
                  title={row.isHiddenFromStorefront ? 'Mostrar en tienda' : 'Ocultar en tienda'}
                >
                  {row.isHiddenFromStorefront ? <Eye size={15} /> : <EyeOff size={15} />}
                  <span>{row.isHiddenFromStorefront ? 'Mostrar' : 'Ocultar'}</span>
                </Button>
              ) : null}
              {canDelete && onDelete ? (
                <GridIconButton
                  label="Eliminar ítem"
                  icon={Trash2}
                  danger
                  className="ecu-catalog-card__btn-delete"
                  disabled={deletingId === row.id}
                  loading={deletingId === row.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(row)
                  }}
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="ecu-catalog-card__footer">
          <span className="ecu-catalog-card__created-at">
            Alta: {formatDate(row.createdAt)}
          </span>
        </div>
      </div>
    )
  }, [canAssignPrice, canDelete, canEdit, canHide, deletingId, hidingId, navigate, onDelete, onToggleHidden])

  return (
    <>
    <DataGrid
      className="ecu-companies-grid"
      dataSource={gridRows}
      keyExpr="id"
      columns={columns}
      selectionMode="none"
      showSearch
      searchPosition="left"
      searchWidth={280}
      searchPlaceholder="Buscar"
      searchKeys={['name', 'sku', 'description', 'categoryName', 'matrixCode']}
      toolbarRight={toolbarRight}
      paging={paging}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      paginationMode="client"
      pageSizeOptions={pageSizeOptions}
      layout="auto"
      cardBreakpoint={768}
      renderCard={renderCard}
      onCardSelect={(row) => {
        if (canEdit) {
          navigate(`/catalogo/items/${row.id}`)
        }
      }}
      loading={loading}
      messages={gridMessages}
    />
    <Popup
      open={previewRow !== null}
      title={previewRow ? resolveDisplayItemName(previewRow) : ''}
      onClose={() => setPreviewRow(null)}
      width="min(92vw, 30rem)"
      actions={[
        { id: 'close', label: 'Cerrar', variant: 'ghost', onClick: () => setPreviewRow(null) },
      ]}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={previewRow?.name ?? ''}
          className="ecu-thumb-preview-image"
          onError={(e) => {
            const fallback = previewRow ? resolveCatalogItemThumbUrl(previewRow) : null
            if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback
          }}
        />
      ) : null}
    </Popup>
    </>
  )
}

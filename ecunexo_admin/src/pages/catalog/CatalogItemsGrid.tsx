import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, type ColumnDef, type DataGridCardRenderContext } from 'glubox'
import { Layers, Package, Pencil, Trash2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { StatusBadge } from '@/components/ui'
import { catalogItemKindLabel, catalogItemStatusLabel } from '@/lib/catalogLabels'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import {
  CatalogItemKind,
  CatalogItemStatus,
  type CatalogItemListItemDto,
} from '@/types/catalogApi'
import './catalogGrid.css'

export type CatalogItemGridRow = CatalogItemListItemDto & Record<string, unknown>

export type CatalogItemsGridProps = {
  readonly rows: CatalogItemListItemDto[]
  readonly loading?: boolean
  readonly canEdit?: boolean
  readonly canDelete?: boolean
  readonly deletingId?: string | null
  readonly onDelete?: (row: CatalogItemListItemDto) => void
  readonly toolbarRight?: ReactNode
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

function CatalogItemGridThumb({ row }: { readonly row: CatalogItemGridRow }) {
  const [hasError, setHasError] = useState(false)
  const thumbUrl = resolveCatalogItemThumbUrl(row)

  if (!thumbUrl || hasError) {
    return (
      <div
        className="catalog-item-thumb catalog-item-thumb--empty"
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
    <img
      src={thumbUrl}
      alt={row.name}
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
  deletingId = null,
  onDelete,
  toolbarRight,
}: CatalogItemsGridProps) {
  const navigate = useNavigate()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<CatalogItemGridRow>[] => {
    const cols: ColumnDef<CatalogItemGridRow>[] = [
      {
        key: 'mainImageThumbUrl',
        header: 'Foto',
        width: 68,
        align: 'center',
        sortable: false,
        renderCell: (_value: unknown, row: CatalogItemGridRow) => (
          <CatalogItemGridThumb row={row} />
        ),
      },
      {
        key: 'name',
        header: 'Nombre',
        width: 240,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['name'], row: CatalogItemGridRow) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong>{row.name}</strong>
            {row.isMatrixParent ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  color: 'var(--shell-primary, #4f46e5)',
                  fontWeight: 600,
                }}
              >
                <Layers size={13} />
                <span>
                  Variantes ({row.variantCount ?? 0})
                </span>
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'kind',
        header: 'Tipo',
        width: 120,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['kind'], row: CatalogItemGridRow) => (
          <StatusBadge tone={row.kind === CatalogItemKind.Physical ? 'info' : 'neutral'}>
            {catalogItemKindLabel(row.kind)}
          </StatusBadge>
        ),
      },
      {
        key: 'sku',
        header: 'SKU',
        width: 140,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['sku'], row: CatalogItemGridRow) =>
          row.sku ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <code className="ecu-code">{row.sku}</code>
              {row.isMatrixParent ? (
                <span
                  style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    background: 'rgba(79, 70, 229, 0.08)',
                    color: 'var(--shell-primary, #4f46e5)',
                    fontWeight: 600,
                  }}
                  title="Código de modelo matriz"
                >
                  Mod
                </span>
              ) : null}
            </span>
          ) : (
            '—'
          ),
      },
      {
        key: 'categoryName',
        header: 'Categoría',
        width: 180,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['categoryName'], row: CatalogItemGridRow) =>
          row.categoryName ?? '—',
      },
      {
        key: 'basePrice',
        header: 'Precio base',
        width: 120,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['basePrice'], row: CatalogItemGridRow) =>
          row.basePrice == null ? '—' : `$ ${row.basePrice.toFixed(2)}`,
      },
      {
        key: 'status',
        header: 'Estado',
        width: 120,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['status'], row: CatalogItemGridRow) => (
          <StatusBadge
            tone={row.status === CatalogItemStatus.Active ? 'success' : 'neutral'}
            withDot={row.status === CatalogItemStatus.Active}
          >
            {catalogItemStatusLabel(row.status)}
          </StatusBadge>
        ),
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 170,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['createdAt'], row: CatalogItemGridRow) =>
          formatDateTime(row.createdAt),
      },
    ]

    if (canEdit || canDelete) {
      cols.push({
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: canDelete ? 112 : 72,
        align: 'center',
        sortable: false,
        renderCell: (_value: CatalogItemGridRow['id'], row: CatalogItemGridRow) => (
          <div className="ecu-companies-grid__actions">
            {canEdit ? (
              <GridIconButton
                label="Editar"
                icon={Pencil}
                onClick={() => navigate(`/catalogo/items/${row.id}`)}
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
  }, [canDelete, canEdit, deletingId, navigate, onDelete])

  const renderCard = useMemo(() => {
    return ({ row }: DataGridCardRenderContext<CatalogItemGridRow>) => (
      <div className="ecu-catalog-card">
        <div className="ecu-catalog-card__header">
          <div className="ecu-catalog-card__thumb-wrap">
            <CatalogItemCardThumb row={row} />
          </div>
          <div className="ecu-catalog-card__header-main">
            <div className="ecu-catalog-card__meta-badges">
              <span className="ecu-catalog-card__category" title={row.categoryName ?? 'Sin categoría'}>
                {row.categoryName ?? 'Sin categoría'}
              </span>
              <StatusBadge
                tone={row.status === CatalogItemStatus.Active ? 'success' : 'neutral'}
                withDot={row.status === CatalogItemStatus.Active}
              >
                {catalogItemStatusLabel(row.status)}
              </StatusBadge>
            </div>

            <h4 className="ecu-catalog-card__title" title={row.name}>
              {row.name}
            </h4>

            {row.isMatrixParent ? (
              <div style={{ margin: '2px 0 6px 0' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    color: 'var(--shell-primary, #4f46e5)',
                    fontWeight: 600,
                  }}
                >
                  <Layers size={13} />
                  <span>
                    Variantes ({row.variantCount ?? 0})
                  </span>
                </span>
              </div>
            ) : null}

            <div className="ecu-catalog-card__tags">
              {row.sku ? (
                <span className="ecu-catalog-card__sku">
                  <span className="ecu-catalog-card__sku-label">
                    {row.isMatrixParent ? 'Modelo:' : 'SKU:'}
                  </span>
                  <code className="ecu-code">{row.sku}</code>
                </span>
              ) : null}
              <StatusBadge tone={row.kind === CatalogItemKind.Physical ? 'info' : 'neutral'}>
                {catalogItemKindLabel(row.kind)}
              </StatusBadge>
            </div>
          </div>
        </div>

        <div className="ecu-catalog-card__body">
          <div className="ecu-catalog-card__price-box">
            <span className="ecu-catalog-card__price-label">Precio base</span>
            <span className="ecu-catalog-card__price-value">
              {row.basePrice == null ? '—' : `$ ${row.basePrice.toFixed(2)}`}
            </span>
          </div>

          {(canEdit || canDelete) && (
            <div className="ecu-catalog-card__actions">
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
              {canDelete && onDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="ecu-catalog-card__btn-delete"
                  disabled={deletingId === row.id}
                  loading={deletingId === row.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(row)
                  }}
                  aria-label={`Eliminar ${row.name}`}
                  title="Eliminar ítem"
                >
                  <Trash2 size={16} />
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <div className="ecu-catalog-card__footer">
          <span className="ecu-catalog-card__created-at">
            Alta: {formatDateTime(row.createdAt)}
          </span>
        </div>
      </div>
    )
  }, [canDelete, canEdit, deletingId, navigate, onDelete])

  return (
    <DataGrid
      className="ecu-companies-grid"
      dataSource={rows as CatalogItemGridRow[]}
      keyExpr="id"
      columns={columns}
      selectionMode="none"
      showSearch
      searchPosition="left"
      searchWidth={280}
      searchPlaceholder="Buscar nombre o SKU…"
      searchKeys={['name', 'sku', 'categoryName', 'description']}
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
  )
}

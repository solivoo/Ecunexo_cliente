import type { DataGridMessages } from 'glubox'

const sharedPagination = {
  paginationAriaLabel: 'Paginación',
  paginationZeroRecords: 'Sin registros',
  paginationRange: (start: number, end: number, total: number) => `${start}–${end} de ${total}`,
  pageStatus: (page: number, totalPages: number) => `Página ${page} de ${totalPages}`,
  firstPage: 'Primera',
  previousPage: 'Anterior',
  nextPage: 'Siguiente',
  lastPage: 'Última',
  rowsPerPage: 'Filas por página',
  selectedCount: (count: number) => `${count} seleccionada${count === 1 ? '' : 's'}`,
  virtualHint: (rendered: number) => `${rendered} visibles`,
} as const

export function createSpanishDataGridMessages(
  entitySingular: string,
  entityPlural: string,
  overrides?: Partial<DataGridMessages>
): DataGridMessages {
  return {
    searchPlaceholder: `Buscar ${entityPlural}…`,
    emptyMessage: `No hay ${entityPlural}.`,
    loading: `Cargando ${entityPlural}…`,
    loadingAriaLabel: `Cargando ${entityPlural}`,
    rowCount: (count: number) => `${count} ${count === 1 ? entitySingular : entityPlural}`,
    ...sharedPagination,
    ...overrides,
  }
}

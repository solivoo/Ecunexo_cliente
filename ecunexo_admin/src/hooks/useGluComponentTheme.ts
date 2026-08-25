import { useSyncExternalStore } from 'react'
import { readCurrentTheme, type EcuThemeMode } from '@/lib/ecuTheme'

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-mode'],
  })
  return () => observer.disconnect()
}

function getSnapshot(): EcuThemeMode {
  return readCurrentTheme()
}

/** Modo claro/oscuro del documento. No pasar a componentes gluBox: sin `theme` heredan data-theme/data-mode. */
export function useGluComponentTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'dark')
}

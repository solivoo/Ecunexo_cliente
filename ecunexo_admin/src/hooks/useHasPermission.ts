import { selectHasPermission } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function useHasPermission(code: string): boolean {
  return useAppSelector((state) => selectHasPermission(state, code))
}

import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { clearHttpMessage, selectHttpMessage, selectPendingHttp } from '@/store/uiSlice'
import './globalStatus.css'

export function GlobalStatus() {
  const dispatch = useAppDispatch()
  const pending = useAppSelector(selectPendingHttp)
  const message = useAppSelector(selectHttpMessage)

  useEffect(() => {
    if (!message) {
      return
    }
    const t = window.setTimeout(() => {
      dispatch(clearHttpMessage())
    }, 6000)
    return () => window.clearTimeout(t)
  }, [dispatch, message])

  return (
    <>
      {pending > 0 ? <div className="global-status__loading" aria-busy="true" /> : null}
      {message ? (
        <div className="global-status__banner" role="status">
          {message}
        </div>
      ) : null}
    </>
  )
}

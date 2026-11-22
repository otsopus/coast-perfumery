import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ labelId, onClose, children, className = '' }: {
  labelId: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={labelId}
      className={`modal ${className}`}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="modal-content">
        <button type="button" className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><X size={21} /></button>
        {children}
      </div>
    </dialog>
  )
}

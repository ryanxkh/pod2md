"use client"

import { useCallback, useEffect, useState } from "react"

interface Toast {
  id: number
  message: string
}

let addToast: ((message: string) => void) | null = null

export function showToast(message: string) {
  addToast?.(message)
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useCallback(() => Date.now(), [])

  useEffect(() => {
    addToast = (message: string) => {
      const id = Date.now()
      setToasts((prev) => [...prev, { id, message }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 2500)
    }
    return () => {
      addToast = null
    }
  }, [nextId])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-[8px] border border-border bg-surface px-4 py-2.5 text-sm text-fg"
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

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
          className="animate-in slide-in-from-bottom-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

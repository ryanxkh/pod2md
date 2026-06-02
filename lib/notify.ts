"use client"

import { toast } from "sonner"

export function notifySuccess(message: string) {
  toast.success(message, { duration: 4000 })
}

export function notifyInfo(message: string) {
  toast.info(message, { duration: 4000 })
}

export function notifyError(
  message: string,
  action?: { label: string; onClick: () => void },
) {
  toast.error(message, {
    duration: Infinity,
    closeButton: true,
    ...(action
      ? {
          action: {
            label: action.label,
            onClick: () => action.onClick(),
          },
        }
      : {}),
  })
}

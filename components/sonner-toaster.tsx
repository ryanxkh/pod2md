"use client"

import { Toaster } from "sonner"

export function SonnerToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      richColors={false}
      closeButton={false}
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-surface !border-border !text-fg !shadow-none",
          title: "!text-fg",
          description: "!text-fg-secondary",
          actionButton:
            "!bg-accent !text-accent-fg hover:!bg-accent-hover",
          cancelButton: "!bg-elevated !text-fg-secondary",
          closeButton:
            "!bg-elevated !border-border !text-fg-secondary hover:!text-fg",
          success: "!text-status-done",
          error: "!text-status-fail",
          info: "!text-fg-secondary",
        },
      }}
    />
  )
}

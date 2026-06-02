"use client"

import { useRouter } from "next/navigation"
import { SubmitForm } from "@/components/submit-form"

export function TranscribePage() {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-fg-secondary">
        Paste a podcast, YouTube, or direct audio URL to start transcription.
      </p>
      <SubmitForm
        onSubmitted={() => {
          router.push("/episodes")
        }}
        onBatchSubmitted={() => {
          router.push("/episodes")
        }}
      />
    </div>
  )
}

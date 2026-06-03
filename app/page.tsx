import { SubmitForm } from "@/components/submit-form"

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-fg-secondary">
        Paste a podcast, YouTube, or direct audio URL to start transcription.
      </p>
      <SubmitForm redirectOnSubmit="/episodes" redirectOnBatchSubmit="/episodes" />
    </div>
  )
}

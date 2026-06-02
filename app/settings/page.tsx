export default function SettingsPage() {
  return (
    <div className="flex max-w-lg flex-col gap-10">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-fg">About</h2>
        <p className="text-sm leading-relaxed text-fg-secondary">
          pod2md turns podcast and video URLs into markdown transcripts with
          speaker labels and timestamps.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-fg">Maintenance</h2>
        <p className="text-sm leading-relaxed text-fg-secondary">
          To backfill episode enrichment metadata, run{" "}
          <code className="rounded-[4px] bg-elevated px-1.5 py-0.5 font-mono text-xs text-fg">
            npm run backfill:enrichment
          </code>{" "}
          from the project CLI on your machine.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-fg">Preferences</h2>
        <p className="text-sm text-fg-muted">More settings coming later.</p>
      </section>
    </div>
  )
}

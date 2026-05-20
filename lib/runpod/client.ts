function baseUrl() {
  return `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}`
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
  }
}

export interface RunPodInput {
  audio_url: string
  source_type: string
}

export interface RunPodStatus {
  id: string
  status: string
  output?: unknown
  error?: string
}

export async function submitJob(
  input: RunPodInput,
  webhook?: string,
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    input,
    policy: {
      executionTimeout: 7_200_000,
      ttl: 10_800_000,
    },
  }
  if (webhook) {
    body.webhook = webhook
  }

  const res = await fetch(`${baseUrl()}/run`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RunPod submit failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { id: string }
  return { id: data.id }
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/cancel/${jobId}`, {
    method: "POST",
    headers: headers(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RunPod cancel failed (${res.status}): ${text}`)
  }
}

export async function getJobStatus(jobId: string): Promise<RunPodStatus> {
  const res = await fetch(`${baseUrl()}/status/${jobId}`, {
    method: "GET",
    headers: headers(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RunPod status failed (${res.status}): ${text}`)
  }

  return (await res.json()) as RunPodStatus
}

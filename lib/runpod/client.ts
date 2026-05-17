export interface RunPodInput {
  audio_url: string;
  source_type: string;
}

export interface RunPodStatus {
  id: string;
  status: string;
  output?: unknown;
  error?: string;
}

function getConfig() {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  if (!apiKey || !endpointId) {
    throw new Error("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set");
  }
  return { apiKey, endpointId };
}

function baseUrl(endpointId: string): string {
  return `https://api.runpod.ai/v2/${endpointId}`;
}

export async function submitJob(
  input: RunPodInput,
  webhookUrl: string,
): Promise<{ id: string }> {
  const { apiKey, endpointId } = getConfig();

  const response = await fetch(`${baseUrl(endpointId)}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      webhook: webhookUrl,
      policy: {
        executionTimeout: 7200000,
        ttl: 10800000,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RunPod API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { id: string };
  return { id: data.id };
}

export async function cancelJob(jobId: string): Promise<void> {
  const { apiKey, endpointId } = getConfig();

  const response = await fetch(`${baseUrl(endpointId)}/cancel/${jobId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RunPod cancel error (${response.status}): ${body}`);
  }
}

export async function getJobStatus(jobId: string): Promise<RunPodStatus> {
  const { apiKey, endpointId } = getConfig();

  const response = await fetch(`${baseUrl(endpointId)}/status/${jobId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RunPod status error (${response.status}): ${body}`);
  }

  return (await response.json()) as RunPodStatus;
}

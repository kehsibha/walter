import { fal } from "@fal-ai/client";
import { getServerEnv } from "@/lib/env/server";

let configured = false;

function ensureFalConfigured() {
  if (configured) return;
  const env = getServerEnv();
  fal.config({
    credentials: env.FAL_KEY,
  });
  configured = true;
}

export type FalRunResult<T> = {
  requestId?: string;
  data: T;
  logs?: unknown;
};

type FalSubscribeResult = { requestId?: string; data?: unknown; logs?: unknown } & Record<string, unknown>;

export async function falSubscribe<TOutput = unknown>(
  endpointId: string,
  input: Record<string, unknown>,
  opts?: {
    onStatus?: (s: unknown) => void;
    webhookUrl?: string;
  }
): Promise<FalRunResult<TOutput>> {
  ensureFalConfigured();

  // `@fal-ai/client` has strong endpoint typing; we keep this dynamic for demo wiring.
  const res = (await (fal as unknown as { subscribe: (id: string, o: unknown) => Promise<unknown> }).subscribe(
    endpointId,
    {
      input,
    logs: true,
    onQueueUpdate: (update: unknown) => {
      opts?.onStatus?.(update);
    },
    webhookUrl: opts?.webhookUrl,
    }
  )) as FalSubscribeResult;

  return {
    requestId: res?.requestId,
    data: ((res?.data ?? res) as unknown) as TOutput,
    logs: res?.logs,
  };
}


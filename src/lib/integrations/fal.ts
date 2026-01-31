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

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fal.ts:falSubscribe:entry',message:'fal.subscribe called',data:{endpointId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E-fal'})}).catch(()=>{});
  // #endregion

  try {
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

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fal.ts:falSubscribe:success',message:'fal.subscribe succeeded',data:{endpointId,requestId:res?.requestId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E-fal'})}).catch(()=>{});
    // #endregion

    return {
      requestId: res?.requestId,
      data: ((res?.data ?? res) as unknown) as TOutput,
      logs: res?.logs,
    };
  } catch (err) {
    // #region agent log
    const errMsg = (err as Error)?.message ?? String(err);
    const errName = (err as Error)?.name ?? 'UnknownError';
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fal.ts:falSubscribe:error',message:'fal.subscribe FAILED',data:{endpointId,errorName:errName,errorMessage:errMsg},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E-fal'})}).catch(()=>{});
    // #endregion
    throw err;
  }
}


import { performance } from 'node:perf_hooks';

function positiveInteger(raw, fallback, maximum, name) {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
  }
  return value;
}

const confirmation = process.env.BENCHMARK_NON_PRODUCTION_CONFIRMED;
if (confirmation !== 'YES') {
  throw new Error(
    'BENCHMARK_NON_PRODUCTION_CONFIRMED=YES is required. Never run this harness against Production.',
  );
}

const environment = process.env.BENCHMARK_ENVIRONMENT ?? 'non-production';
if (/^prod(?:uction)?$/i.test(environment.trim())) {
  throw new Error('The V1.0-D benchmark harness refuses a Production environment label.');
}

const rawBaseUrl =
  process.env.BENCHMARK_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const baseUrl = new URL(rawBaseUrl.endsWith('/') ? rawBaseUrl : rawBaseUrl + '/');
const email = process.env.BENCHMARK_EMAIL;
const password = process.env.BENCHMARK_PASSWORD;
if (!email || !password) {
  throw new Error('BENCHMARK_EMAIL and BENCHMARK_PASSWORD are required.');
}

const iterations = positiveInteger(
  process.env.BENCHMARK_ITERATIONS,
  20,
  500,
  'BENCHMARK_ITERATIONS',
);
const concurrency = positiveInteger(
  process.env.BENCHMARK_CONCURRENCY,
  2,
  20,
  'BENCHMARK_CONCURRENCY',
);

async function request(path, init = {}) {
  const startedAt = performance.now();
  const response = await fetch(new URL(path, baseUrl), init);
  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.arrayBuffer();
  const durationMs = performance.now() - startedAt;

  if (!response.ok) {
    const detail =
      data instanceof ArrayBuffer
        ? `non-JSON response (${data.byteLength} bytes)`
        : JSON.stringify(data).slice(0, 200);
    throw new Error(
      `${init.method ?? 'GET'} ${path} failed with ${response.status}: ${detail}`,
    );
  }
  return { response, data, durationMs };
}

const login = await request('auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const setCookie = login.response.headers.get('set-cookie');
if (!setCookie) throw new Error('Benchmark login did not return a session cookie.');
const cookie = setCookie.split(';', 1)[0];
const csrfToken = login.data?.data?.csrfToken;
if (typeof csrfToken !== 'string' || !csrfToken) {
  throw new Error('Benchmark login did not return a CSRF token.');
}

async function authorizedRequest(path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set('cookie', cookie);
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(init.method ?? 'GET')) {
    headers.set('x-csrf-token', csrfToken);
  }
  return request(path, { ...init, headers });
}

const projectFixtureResponse = await authorizedRequest('projects');
const projectFixture = Array.isArray(projectFixtureResponse.data?.data)
  ? projectFixtureResponse.data.data.find((item) => item?.isActive !== false)
  : undefined;
if (!projectFixture?.id) {
  throw new Error(
    'Benchmark requires at least one authorized Project fixture. Run live acceptance first.',
  );
}
const projectId = projectFixture.id;
const originalDescription = projectFixture.description ?? null;

async function runFlow(name, operation, flowConcurrency = concurrency) {
  const samples = [];
  let next = 0;
  const wallStartedAt = performance.now();
  const workers = Array.from({ length: flowConcurrency }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= iterations) return;
      samples.push(await operation(index));
    }
  });
  await Promise.all(workers);
  const wallMs = performance.now() - wallStartedAt;
  samples.sort((a, b) => a - b);
  const percentile = (p) =>
    samples[
      Math.min(
        samples.length - 1,
        Math.max(0, Math.ceil(samples.length * p) - 1),
      )
    ];
  const averageMs =
    samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return {
    name,
    count: samples.length,
    concurrency: flowConcurrency,
    wallMs: Math.round(wallMs * 1000) / 1000,
    throughputPerSecond:
      Math.round((samples.length / (wallMs / 1000)) * 1000) / 1000,
    latencyMs: {
      average: Math.round(averageMs * 1000) / 1000,
      p50: Math.round(percentile(0.5) * 1000) / 1000,
      p95: Math.round(percentile(0.95) * 1000) / 1000,
      max: Math.round(samples.at(-1) * 1000) / 1000,
    },
  };
}

const readinessFlow = await runFlow('readiness', async () => {
  const result = await request('health/ready');
  return result.durationMs;
});

const projectReadFlow = await runFlow('erp-project-list-read', async () => {
  const result = await authorizedRequest('projects');
  return result.durationMs;
});

async function restoreProjectDescription() {
  return authorizedRequest(`projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ description: originalDescription }),
  });
}

let projectMutationFlow;
let mutationFlowError;
try {
  projectMutationFlow = await runFlow(
    'erp-project-description-update-and-restore',
    async (index) => {
      const marker = `V1.0-D benchmark ${process.pid}-${Date.now()}-${index}`;
      let mutationMayHaveBeenSent = false;
      try {
        mutationMayHaveBeenSent = true;
        const result = await authorizedRequest(`projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ description: marker }),
        });
        return result.durationMs;
      } finally {
        if (mutationMayHaveBeenSent) {
          await restoreProjectDescription();
        }
      }
    },
    1,
  );
} catch (error) {
  mutationFlowError = error;
}

// Always make one final idempotent restore attempt after the mutation flow. A
// failed response is ambiguous: the server may still have committed the PATCH,
// so final state is determined by the authoritative read below.
try {
  await restoreProjectDescription();
} catch {
  // Verification below decides whether cleanup actually succeeded.
}

const verification = await authorizedRequest(`projects/${projectId}`);
if ((verification.data?.data?.description ?? null) !== originalDescription) {
  throw new Error('Benchmark cleanup did not restore the Project description.');
}
if (mutationFlowError) throw mutationFlowError;

console.log(
  JSON.stringify({
    benchmark: 'v1.0-d-representative-capacity',
    environment,
    baseOrigin: baseUrl.origin,
    node: process.version,
    iterationsPerFlow: iterations,
    requestedReadConcurrency: concurrency,
    timing: 'end-to-end through complete response-body consumption',
    fixture: {
      projectId: 'existing-authorized-project',
      businessMutation: 'Project description update with deterministic restore',
    },
    flows: [readinessFlow, projectReadFlow, projectMutationFlow],
    limitations: [
      'Results apply only to the tested non-Production environment and fixture.',
      'Project mutation concurrency is intentionally 1 so each measured update is restored deterministically before the next sample.',
      'Audit evidence from the reversible Project update remains part of the non-Production fixture.',
      'This evidence is not a contractual SLA, universal capacity ceiling, or hosting-size guarantee.',
    ],
  }),
);

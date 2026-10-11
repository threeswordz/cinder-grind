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

const iterations = positiveInteger(process.env.BENCHMARK_ITERATIONS, 20, 500, 'BENCHMARK_ITERATIONS');
const concurrency = positiveInteger(process.env.BENCHMARK_CONCURRENCY, 2, 20, 'BENCHMARK_CONCURRENCY');

async function request(path, init = {}) {
  const startedAt = performance.now();
  const response = await fetch(new URL(path, baseUrl), init);
  const durationMs = performance.now() - startedAt;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${init.method ?? 'GET'} ${path} failed with ${response.status}: ${body.slice(0, 200)}`);
  }
  return { response, durationMs };
}

const login = await request('auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const setCookie = login.response.headers.get('set-cookie');
if (!setCookie) throw new Error('Benchmark login did not return a session cookie.');
const cookie = setCookie.split(';', 1)[0];

async function runFlow(name, operation) {
  const samples = [];
  let next = 0;
  const wallStartedAt = performance.now();
  const workers = Array.from({ length: concurrency }, async () => {
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
    samples[Math.min(samples.length - 1, Math.max(0, Math.ceil(samples.length * p) - 1))];
  const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return {
    name,
    count: samples.length,
    concurrency,
    wallMs: Math.round(wallMs * 1000) / 1000,
    throughputPerSecond: Math.round((samples.length / (wallMs / 1000)) * 1000) / 1000,
    latencyMs: {
      average: Math.round(averageMs * 1000) / 1000,
      p50: Math.round(percentile(0.5) * 1000) / 1000,
      p95: Math.round(percentile(0.95) * 1000) / 1000,
      max: Math.round(samples.at(-1) * 1000) / 1000,
    },
  };
}

const readFlow = await runFlow('authenticated-read-auth-me', async () => {
  const result = await request('auth/me', { headers: { cookie } });
  await result.response.arrayBuffer();
  return result.durationMs;
});

const mutationFlow = await runFlow('safe-session-mutation-csrf-rotation', async () => {
  const result = await request('auth/csrf', { headers: { cookie } });
  await result.response.arrayBuffer();
  return result.durationMs;
});

const readinessFlow = await runFlow('readiness', async () => {
  const result = await request('health/ready');
  await result.response.arrayBuffer();
  return result.durationMs;
});

console.log(
  JSON.stringify({
    benchmark: 'v1.0-d-representative-capacity',
    environment,
    baseOrigin: baseUrl.origin,
    node: process.version,
    iterationsPerFlow: iterations,
    concurrency,
    fixture: {
      authenticatedUser: 'configured-non-production-user',
      businessMutation: false,
    },
    flows: [readinessFlow, readFlow, mutationFlow],
    limitations: [
      'Results apply only to the tested non-Production environment and fixture.',
      'The mutation flow rotates session CSRF state and does not mutate ERP business records.',
      'This evidence is not a contractual SLA, universal capacity ceiling, or hosting-size guarantee.',
    ],
  }),
);

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

type ProblemDetails = {
  detail?: string;
  code?: string;
};

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return {};
  }
}

export function setCsrfToken(value: string | null): void {
  csrfToken = value;
}

export async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const response = await fetch(apiBaseUrl + '/auth/csrf', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const problem = await readProblem(response);
    throw new ApiError(
      problem.detail ?? 'Unable to obtain CSRF token.',
      response.status,
      problem.code,
    );
  }

  const payload = (await response.json()) as {
    data: { csrfToken: string };
  };
  csrfToken = payload.data.csrfToken;
  return csrfToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (mutation && path !== '/auth/login') {
    headers.set('X-CSRF-Token', await ensureCsrfToken());
  }

  const response = await fetch(apiBaseUrl + path, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    const problem = await readProblem(response);
    if (response.status === 401) csrfToken = null;
    throw new ApiError(
      problem.detail ?? 'Request failed.',
      response.status,
      problem.code,
    );
  }

  return (await response.json()) as T;
}

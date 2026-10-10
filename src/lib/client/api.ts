// Cliente das rotas /api. Sessão via cookie; o header X-Requested-With é exigido pelo servidor.
import type { User, Visit, VisitListItem, VisitUpdate } from '@/lib/types';
import type { PendingRecording } from './queue';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
  }

  /** Erros em que vale a pena reenviar depois (sem rede, limite, falha da IA ou do servidor). */
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** Disparado em qualquer 401; o AppProvider volta para a tela de login. */
export const AUTH_REQUIRED_EVENT = 'auth:required';

async function request<T>(path: string, init: { method?: string; json?: unknown; body?: BodyInit } = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'fetch' };
  let body = init.body;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }

  let response: Response;
  try {
    response = await fetch(`/api/${path}`, { method: init.method ?? 'GET', headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Sem conexão com o servidor.', 0);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    throw new ApiError(data.error || `Erro ${response.status}`, response.status, data);
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: User }>('auth'),
  login: (email: string, password: string) =>
    request<{ user: User }>('auth', { method: 'POST', json: { email, password } }),
  logout: () => request('auth', { method: 'DELETE' }),

  process(item: PendingRecording) {
    const form = new FormData();
    form.append('audio', item.blob, 'visita.wav');
    form.append('client_uuid', item.uuid);
    form.append('visited_at', item.visitedAt);
    form.append('duration', String(item.duration));
    return request<{ visit: Visit }>('process', { method: 'POST', body: form });
  },

  listVisits: (q = '', page = 1) =>
    request<{ visits: VisitListItem[]; per_page: number }>(`visits?q=${encodeURIComponent(q)}&page=${page}`),
  getVisit: (id: number) => request<{ visit: Visit }>(`visits/${id}`),
  saveVisit: (id: number, data: VisitUpdate) => request<{ visit: Visit }>(`visits/${id}`, { method: 'PUT', json: data }),
};

// Tipos compartilhados entre o servidor (route handlers) e o navegador.

export type Role = 'avaliador' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export type VisitStatus = 'processing' | 'draft' | 'confirmed' | 'error';

export const STATUS_LABELS: Record<VisitStatus, string> = {
  processing: 'Processando',
  draft: 'Rascunho',
  confirmed: 'Confirmada',
  error: 'Erro',
};

/** Conteúdo de visits.summary_json */
export interface VisitSummary {
  resumo: string;
  impressoes: string[];
  analises: string[];
}

export interface VisitAction {
  id?: number;
  description: string;
  owner: string;
  due: string;
  done: boolean;
}

export interface VisitListItem {
  id: number;
  client_uuid: string;
  user_name: string;
  store_name: string;
  manager_name: string;
  /** "YYYY-MM-DD HH:MM:SS" no fuso America/Sao_Paulo */
  visited_at: string;
  audio_seconds: number | null;
  status: VisitStatus;
  error_message: string | null;
  updated_at: string;
  summary: VisitSummary;
  open_actions?: number;
}

export interface Visit extends VisitListItem {
  transcript: string;
  actions: VisitAction[];
}

/** Corpo do PUT /api/visits/[id] (tela de revisão) */
export interface VisitUpdate {
  store_name: string;
  manager_name: string;
  visited_at: string;
  summary: VisitSummary;
  actions: VisitAction[];
  status: 'draft' | 'confirmed';
}

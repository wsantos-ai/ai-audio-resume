'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/client/api';
import { formatDate, formatDuration } from '@/lib/client/format';
import { STATUS_LABELS, type Visit, type VisitAction, type VisitUpdate } from '@/lib/types';
import { useApp } from './AppProvider';

interface FormState {
  store_name: string;
  manager_name: string;
  visited_at: string;
  resumo: string;
  /** Uma por linha */
  impressoes: string;
  analises: string;
  actions: VisitAction[];
}

function toForm(visit: Visit): FormState {
  return {
    store_name: visit.store_name,
    manager_name: visit.manager_name,
    visited_at: visit.visited_at.replace(' ', 'T').slice(0, 16),
    resumo: visit.summary.resumo ?? '',
    impressoes: (visit.summary.impressoes ?? []).join('\n'),
    analises: (visit.summary.analises ?? []).join('\n'),
    actions: visit.actions,
  };
}

function toUpdate(form: FormState, status: VisitUpdate['status']): VisitUpdate {
  const lines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    store_name: form.store_name,
    manager_name: form.manager_name,
    visited_at: form.visited_at,
    summary: { resumo: form.resumo, impressoes: lines(form.impressoes), analises: lines(form.analises) },
    actions: form.actions,
    status,
  };
}

/** Texto para WhatsApp/e-mail */
function shareText(data: VisitUpdate) {
  const bullets = (items: string[]) => items.map((s) => `• ${s}`).join('\n');
  const actions = data.actions.filter((a) => a.description.trim());
  return [
    `*Visita: ${data.store_name || 'Loja não informada'}*`,
    `Gestor: ${data.manager_name || '-'}`,
    `Data: ${formatDate(data.visited_at)}`,
    '',
    data.summary.resumo,
    data.summary.impressoes.length ? `\n*Impressões*\n${bullets(data.summary.impressoes)}` : '',
    data.summary.analises.length ? `\n*Análises*\n${bullets(data.summary.analises)}` : '',
    actions.length
      ? `\n*Ações*\n${actions
          .map((a) => `${a.done ? '☑' : '☐'} ${a.description}${a.owner ? ` — ${a.owner}` : ''}${a.due ? ` (${a.due})` : ''}`)
          .join('\n')}`
      : '',
  ]
    .filter((line) => line !== '')
    .join('\n')
    .trim();
}

export function VisitReview({ id }: { id: number }) {
  const { toast } = useApp();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getVisit(id)
      .then(({ visit }) => {
        setVisit(visit);
        setForm(toForm(visit));
      })
      .catch((err: Error) => toast(err.message));
  }, [id, toast]);

  if (!visit || !form) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm({ ...form, [key]: value });
  const setAction = (index: number, patch: Partial<VisitAction>) =>
    set(
      'actions',
      form.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = submitter?.value === 'confirmed' ? 'confirmed' : 'draft';
    setSaving(true);
    try {
      const { visit } = await api.saveVisit(id, toUpdate(form!, status));
      setVisit(visit);
      setForm(toForm(visit));
      toast(status === 'confirmed' ? 'Visita confirmada.' : 'Rascunho salvo.');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    const data = toUpdate(form!, 'draft');
    const text = shareText(data);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Visita ${data.store_name}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast('Resumo copiado.');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast('Não foi possível compartilhar.');
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="review-head">
        <h2>Visita</h2>
        <span className={`badge ${visit.status}`}>{STATUS_LABELS[visit.status]}</span>
      </div>
      <p className="meta">
        Gravada por {visit.user_name}
        {visit.audio_seconds ? ` · ${formatDuration(visit.audio_seconds)} de áudio` : ''}
      </p>
      {visit.error_message && <p className="error">Falha no processamento: {visit.error_message}</p>}

      <label>
        Loja
        <input value={form.store_name} maxLength={190} onChange={(e) => set('store_name', e.target.value)} />
      </label>
      <label>
        Gestor
        <input value={form.manager_name} maxLength={190} onChange={(e) => set('manager_name', e.target.value)} />
      </label>
      <label>
        Data da visita
        <input
          type="datetime-local"
          required
          value={form.visited_at}
          onChange={(e) => set('visited_at', e.target.value)}
        />
      </label>
      <label>
        Resumo
        <textarea rows={4} value={form.resumo} onChange={(e) => set('resumo', e.target.value)} />
      </label>
      <label>
        Impressões <small>(uma por linha)</small>
        <textarea rows={5} value={form.impressoes} onChange={(e) => set('impressoes', e.target.value)} />
      </label>
      <label>
        Análises <small>(uma por linha)</small>
        <textarea rows={5} value={form.analises} onChange={(e) => set('analises', e.target.value)} />
      </label>

      <fieldset>
        <legend>Ações</legend>
        <ul className="actions">
          {form.actions.map((action, i) => (
            <li className="action" key={action.id ?? `new-${i}`}>
              <input
                type="checkbox"
                aria-label="Concluída"
                checked={action.done}
                onChange={(e) => setAction(i, { done: e.target.checked })}
              />
              <div className="action-fields">
                <input
                  placeholder="Ação"
                  value={action.description}
                  onChange={(e) => setAction(i, { description: e.target.value })}
                />
                <div className="action-row">
                  <input
                    placeholder="Responsável"
                    value={action.owner}
                    onChange={(e) => setAction(i, { owner: e.target.value })}
                  />
                  <input
                    placeholder="Prazo"
                    maxLength={100}
                    value={action.due}
                    onChange={(e) => setAction(i, { due: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="button"
                className="link remove"
                aria-label="Remover ação"
                onClick={() => set('actions', form.actions.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn small"
          onClick={() => set('actions', [...form.actions, { description: '', owner: '', due: '', done: false }])}
        >
          + Adicionar ação
        </button>
      </fieldset>

      <details>
        <summary>Transcrição do áudio</summary>
        <p className="transcript">{visit.transcript || '(sem transcrição)'}</p>
      </details>

      <div className="form-buttons">
        <button type="button" className="btn" onClick={share}>
          Compartilhar
        </button>
        <button type="submit" className="btn" name="status" value="draft" disabled={saving}>
          Salvar rascunho
        </button>
        <button type="submit" className="btn primary" name="status" value="confirmed" disabled={saving}>
          Confirmar
        </button>
      </div>
    </form>
  );
}

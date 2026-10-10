'use client';

import { formatDate, formatDuration } from '@/lib/client/format';
import { useApp } from './AppProvider';

/** Gravações que ainda não foram processadas pelo servidor (sem internet ou com erro). */
export function PendingList() {
  const { pending, sending, sendItem, discard } = useApp();
  if (!pending.length) return null;

  return (
    <div className="card">
      <h2>Envios pendentes</h2>
      <ul className="list">
        {pending.map((item) => {
          const isSending = sending.includes(item.uuid);
          return (
            <li key={item.uuid}>
              <div>
                <strong>
                  {formatDate(item.visitedAt)} · {formatDuration(item.duration)}
                </strong>
                {item.lastError && <small className="error">{item.lastError}</small>}
                {isSending && <small>Enviando…</small>}
              </div>
              <div className="li-buttons">
                <button
                  type="button"
                  className="btn small primary"
                  disabled={isSending}
                  onClick={() => sendItem(item, { openResult: true })}
                >
                  Enviar
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  disabled={isSending}
                  onClick={() => confirm('Descartar esta gravação? O áudio será perdido.') && discard(item.uuid)}
                >
                  Descartar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

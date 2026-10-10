'use client';

import { useEffect, useRef, useState } from 'react';
import { Recorder } from '@/lib/client/recorder';
import { formatDuration } from '@/lib/client/format';
import { useApp } from './AppProvider';

// Deve ser igual a MAX_AUDIO_SECONDS do servidor
const MAX_SECONDS = Number(process.env.NEXT_PUBLIC_MAX_AUDIO_SECONDS || 900);

export function RecordPanel() {
  const { enqueue, toast, setRecording, sending } = useApp();
  const recorderRef = useRef<Recorder | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [status, setStatus] = useState<'inactive' | 'recording' | 'paused'>('inactive');
  const [elapsed, setElapsed] = useState(0);

  // Atualiza o cronômetro e encerra ao atingir o tempo máximo
  useEffect(() => {
    if (status === 'inactive') return;
    const timer = setInterval(() => {
      const duration = recorderRef.current?.duration ?? 0;
      setElapsed(duration);
      if (duration >= MAX_SECONDS) {
        toast('Tempo máximo atingido. Gravação concluída.');
        finish();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [status]);

  // Evita perder a gravação ao fechar/recarregar a página
  useEffect(() => {
    if (status === 'inactive') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  // Descarta a gravação se o componente for desmontado no meio
  useEffect(
    () => () => {
      recorderRef.current?.cancel();
      setRecording(false);
    },
    [setRecording],
  );

  async function start() {
    const recorder = new Recorder();
    try {
      await recorder.start();
    } catch (err) {
      const error = err as Error;
      toast(
        error.name === 'NotAllowedError'
          ? 'Permita o acesso ao microfone para gravar.'
          : `Não foi possível gravar: ${error.message}`,
      );
      return;
    }
    recorderRef.current = recorder;
    wakeLockRef.current = (await navigator.wakeLock?.request('screen').catch(() => null)) ?? null;
    setElapsed(0);
    setStatus('recording');
    setRecording(true);
  }

  async function togglePause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      await recorder.pause();
      setStatus('paused');
    } else {
      await recorder.resume();
      setStatus('recording');
    }
  }

  async function finish() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    const { blob, duration } = await recorder.stop();
    reset();
    if (duration < 2) {
      toast('Gravação muito curta.');
      return;
    }
    const now = new Date().toISOString();
    await enqueue({ uuid: crypto.randomUUID(), blob, duration, visitedAt: now, createdAt: now, lastError: null });
  }

  async function cancel() {
    if (!recorderRef.current || !confirm('Descartar esta gravação?')) return;
    await recorderRef.current.cancel();
    recorderRef.current = null;
    reset();
  }

  function reset() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setStatus('inactive');
    setElapsed(0);
    setRecording(false);
  }

  return (
    <>
      <div className={`card recorder${status === 'recording' ? ' recording' : ''}`}>
        <div className="timer">{formatDuration(elapsed)}</div>
        <p className="hint">
          Ao final da visita, fale o <strong>nome da loja</strong>, o <strong>gestor</strong>, suas{' '}
          <strong>impressões</strong>, <strong>análises</strong> e as <strong>ações</strong> a serem realizadas.
        </p>
        <button
          type="button"
          className="rec-btn"
          aria-label="Iniciar gravação"
          onClick={start}
          disabled={status !== 'inactive'}
        >
          <span />
        </button>
        {status !== 'inactive' && (
          <div className="rec-controls">
            <button type="button" className="btn" onClick={togglePause}>
              {status === 'paused' ? 'Continuar' : 'Pausar'}
            </button>
            <button type="button" className="btn primary" onClick={finish}>
              Concluir
            </button>
            <button type="button" className="btn danger" onClick={cancel}>
              Descartar
            </button>
          </div>
        )}
      </div>

      {sending.length > 0 && (
        <div className="card processing">
          <div className="spinner" />
          <p>
            Transcrevendo e resumindo o áudio…
            <br />
            <small>Isso pode levar até um minuto.</small>
          </p>
        </div>
      )}
    </>
  );
}

import { config } from '@/lib/server/config';
import { assertFetchRequest, handler, HttpError, json } from '@/lib/server/http';
import { OpenRouterError, summarize, transcribe } from '@/lib/server/openrouter';
import { requireUser } from '@/lib/server/session';
import * as visits from '@/lib/server/visits';

// POST multipart: audio (WAV 16 kHz mono), client_uuid, visited_at (ISO), duration (segundos).
// Transcreve e resume via OpenRouter e grava a visita como "draft". O áudio não é armazenado.
// Atenção: não crie um proxy.ts/middleware.ts que intercepte esta rota — ele limita o corpo da requisição a 10 MB.

export const runtime = 'nodejs';
export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = handler(async (request: Request) => {
  assertFetchRequest(request);
  const user = await requireUser();
  const form = await request.formData().catch(() => {
    throw new HttpError(400, 'Requisição inválida.');
  });

  const uuid = String(form.get('client_uuid') ?? '');
  if (!UUID_RE.test(uuid)) throw new HttpError(400, 'client_uuid inválido.');

  // Reenvio da fila offline: se a visita já foi processada, só devolve o resultado
  let visitId = await visits.findIdByClientUuid(user.id, uuid);
  if (visitId !== null) {
    const existing = (await visits.findVisit(visitId, user))!;
    const updatedAt = new Date(existing.updated_at.replace(' ', 'T') + '-03:00').getTime();
    if (existing.status === 'processing' && updatedAt > Date.now() - 5 * 60_000) {
      // Outra requisição ainda está processando este áudio
      return json({ visit: existing }, 202);
    }
    if (existing.status === 'draft' || existing.status === 'confirmed') {
      return json({ visit: existing });
    }
  }

  const file = form.get('audio');
  if (!(file instanceof File)) throw new HttpError(400, 'Áudio não recebido.');
  if (file.size > config.limits.maxUploadBytes) throw new HttpError(413, 'Áudio muito grande.');
  const wav = Buffer.from(await file.arrayBuffer());
  if (wav.toString('latin1', 0, 4) !== 'RIFF' || wav.toString('latin1', 8, 12) !== 'WAVE') {
    throw new HttpError(400, 'Formato de áudio inválido (esperado WAV).');
  }
  const durationRaw = Number(form.get('duration'));
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : null;
  if (duration !== null && duration > config.limits.maxAudioSeconds) {
    throw new HttpError(413, 'Áudio mais longo que o permitido.');
  }

  if (visitId === null) {
    if ((await visits.countRecent(user.id, 60)) >= config.limits.maxVisitsPerHour) {
      throw new HttpError(429, 'Limite de envios por hora atingido. Tente mais tarde.');
    }
    const visitedAt = visits.normalizeDate(String(form.get('visited_at') ?? ''));
    visitId = await visits.createProcessing(user.id, uuid, visitedAt, duration);
  } else {
    await visits.resetForRetry(visitId);
  }

  // O processamento não depende da conexão do cliente: se o celular cair, o resultado aparece no histórico
  try {
    const transcript = await transcribe(wav);
    await visits.saveTranscript(visitId, transcript, config.openrouter.modelTranscription);

    const visit = (await visits.findVisit(visitId, user))!;
    const summary = await summarize(transcript, visit.visited_at);
    await visits.saveSummary(visitId, summary, config.openrouter.modelSummary);
  } catch (err) {
    if (!(err instanceof OpenRouterError)) {
      await visits.markError(visitId, 'Erro interno no processamento.');
      throw err;
    }
    console.error(err);
    await visits.markError(visitId, err.message);
    return json({ error: err.message, visit: await visits.findVisit(visitId, user) }, 502);
  }

  return json({ visit: await visits.findVisit(visitId, user) });
});

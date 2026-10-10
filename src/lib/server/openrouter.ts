import 'server-only';
import { config } from './config';
import { SUMMARY_PROMPT, SUMMARY_SCHEMA, TRANSCRIPTION_PROMPT, type AiSummary } from './prompts';

export class OpenRouterError extends Error {}

/** Transcreve um WAV usando um modelo com entrada de áudio. */
export async function transcribe(wav: Buffer): Promise<string> {
  const text = await chat({
    model: config.openrouter.modelTranscription,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: TRANSCRIPTION_PROMPT },
          { type: 'input_audio', input_audio: { data: wav.toString('base64'), format: 'wav' } },
        ],
      },
    ],
    temperature: 0,
  });
  return text.trim();
}

/** Gera o resumo estruturado (SUMMARY_SCHEMA) a partir da transcrição. */
export async function summarize(transcript: string, visitedAt: string): Promise<AiSummary> {
  const text = await chat({
    model: config.openrouter.modelSummary,
    messages: [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: `Data da visita: ${visitedAt}\n\nTranscrição:\n${transcript}` },
    ],
    temperature: 0.2,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'resumo_visita', strict: true, schema: SUMMARY_SCHEMA },
    },
  });

  // Alguns modelos ainda envolvem o JSON em ```json ... ```
  const clean = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(clean) as AiSummary;
  } catch {
    throw new OpenRouterError('O modelo não retornou um JSON válido.');
  }
}

async function chat(payload: Record<string, unknown>): Promise<string> {
  const { apiKey, baseUrl, timeoutMs, appUrl, appName } = config.openrouter;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': appUrl,
        'X-Title': appName,
      },
      // Não roteia para provedores que guardam/treinam com os dados (LGPD)
      body: JSON.stringify({ ...payload, provider: { data_collection: 'deny' } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new OpenRouterError(`Falha de conexão com a OpenRouter: ${(err as Error).message}`);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    throw new OpenRouterError(`OpenRouter: ${data?.error?.message ?? `HTTP ${response.status}`}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new OpenRouterError('Resposta vazia da OpenRouter.');
  }
  return content;
}

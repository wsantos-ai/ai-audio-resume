import 'server-only';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não definida (veja .env.example).`);
  return value;
}

// Lido sob demanda para não quebrar o `next build` quando as variáveis só existem em produção
export const config = {
  get db() {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      database: required('DB_NAME'),
      user: required('DB_USER'),
      password: process.env.DB_PASSWORD || '',
    };
  },
  get sessionSecret() {
    const secret = required('SESSION_SECRET');
    if (secret.length < 32) throw new Error('SESSION_SECRET precisa ter ao menos 32 caracteres.');
    return secret;
  },
  get openrouter() {
    return {
      apiKey: required('OPENROUTER_API_KEY'),
      baseUrl: 'https://openrouter.ai/api/v1',
      modelTranscription: process.env.OPENROUTER_MODEL_TRANSCRIPTION || 'google/gemini-2.5-flash',
      modelSummary: process.env.OPENROUTER_MODEL_SUMMARY || 'google/gemini-2.5-flash',
      timeoutMs: 110_000,
      appUrl: process.env.APP_URL || '',
      appName: process.env.APP_NAME || 'Resumo de Visitas',
    };
  },
  limits: {
    maxAudioSeconds: Number(process.env.MAX_AUDIO_SECONDS || 900),
    // WAV 16 kHz mono ≈ 1,9 MB/min
    maxUploadBytes: 35 * 1024 * 1024,
    maxVisitsPerHour: Number(process.env.MAX_VISITS_PER_HOUR || 20),
  },
  isProduction: process.env.NODE_ENV === 'production',
};

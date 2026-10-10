import 'server-only';

// Prompts e schema do resumo. Ao mudar SUMMARY_SCHEMA, ajuste também AiSummary,
// saveSummary() em visits.ts e o formulário de revisão (components/VisitReview.tsx).

export const TRANSCRIPTION_PROMPT = `Transcreva fielmente este áudio em português do Brasil.
Retorne somente o texto falado, sem comentários, títulos ou marcações de tempo.
Corrija apenas pontuação. Não resuma e não invente trechos inaudíveis; marque-os como [inaudível].`;

export const SUMMARY_PROMPT = `Você é um assistente que organiza relatórios de visitas a lojas.
O texto recebido é a transcrição de um áudio gravado por um avaliador ao final de uma visita, em que ele informa
o nome da loja, o gestor responsável, suas impressões, análises e as ações a serem realizadas.

Regras:
- Use apenas informações presentes na transcrição. Se algo não foi dito, use string vazia ou lista vazia.
- "resumo": 2 a 4 frases objetivas sobre a visita.
- "impressoes": percepções do avaliador (ambiente, atendimento, organização, equipe etc.), uma por item.
- "analises": diagnósticos, causas, números e comparações mencionadas, uma por item.
- "acoes": cada ação concreta a ser feita, com responsável e prazo quando mencionados (prazo em texto livre).
- Escreva em português do Brasil, frases curtas e diretas.`;

/** Formato devolvido pelo modelo de resumo */
export interface AiSummary {
  loja: string;
  gestor: string;
  resumo: string;
  impressoes: string[];
  analises: string[];
  acoes: { descricao: string; responsavel: string; prazo: string }[];
}

export const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['loja', 'gestor', 'resumo', 'impressoes', 'analises', 'acoes'],
  properties: {
    loja: { type: 'string', description: 'Nome da loja visitada' },
    gestor: { type: 'string', description: 'Nome do gestor da loja' },
    resumo: { type: 'string' },
    impressoes: { type: 'array', items: { type: 'string' } },
    analises: { type: 'array', items: { type: 'string' } },
    acoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['descricao', 'responsavel', 'prazo'],
        properties: {
          descricao: { type: 'string' },
          responsavel: { type: 'string' },
          prazo: { type: 'string' },
        },
      },
    },
  },
} as const;

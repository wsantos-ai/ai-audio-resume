# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com o código deste repositório.

## Projeto

PWA para avaliadores de lojas: ao final de uma visita o usuário grava um áudio (loja, gestor, impressões, análises,
ações); o servidor transcreve e resume via OpenRouter e grava o resultado em MySQL. Next.js 16 (App Router,
TypeScript, sem Tailwind — CSS puro em `src/app/globals.css`), `mysql2` sem ORM, `iron-session` para a sessão e
`bcryptjs` para senhas. Hospedagem alvo: Hostinger (app Node.js nos planos Business/Cloud, ou VPS).

## Comandos

```bash
npm run dev                                          # servidor de desenvolvimento (precisa de .env.local + MySQL)
npm run build                                        # build de produção com webpack (também checa tipos)
NEXT_TEST_WASM=1 npm run build                       # simula o build da Hostinger (SWC em WebAssembly)
npm run typecheck                                    # só TypeScript (tsc --noEmit)
npm run create-user -- email "Nome" [avaliador|admin] # cria/atualiza usuário (não existe tela de cadastro)
mysql -u USER -p DB < database/schema.sql            # cria as tabelas
```

Não há linter nem testes automatizados. O `next build` funciona sem as variáveis de ambiente, pois
`src/lib/server/config.ts` lê o env sob demanda (getters); mantenha assim.

## Arquitetura

**Separação servidor/navegador.** `src/lib/server/*` importa `server-only` (config, banco, sessão, OpenRouter, prompts,
visitas) e só é usado pelos route handlers em `src/app/api/`. `src/lib/client/*` só roda no navegador (gravador, fila
IndexedDB, cliente da API). `src/lib/types.ts` é o contrato compartilhado entre os dois lados.

**Telas são client components sobre um shell estático.** As páginas (`/`, `/historico`, `/login`) são pré-renderizadas
como estáticas e buscam dados pela API no navegador; não há busca de dados em server components nem
`proxy.ts`/middleware. Isso é deliberado: o app precisa abrir offline (HTML em cache pelo `public/sw.js`), e a
autenticação é aplicada nas rotas da API (`requireUser()`). `AppShell` redireciona para `/login` no cliente.
`AppProvider` concentra o estado global: usuário, toast e a fila de envio.

**Fluxo de uma visita:**
1. `lib/client/recorder.ts` captura o PCM do microfone com um AudioWorklet (`public/pcm-worklet.js`), reamostra em
   streaming para 16 kHz mono e gera um WAV. MediaRecorder não é usado de propósito: gera webm/mp4, e a entrada de áudio
   da OpenRouter espera wav/mp3. O servidor rejeita o que não for RIFF/WAVE.
2. `AppProvider.enqueue()` grava a gravação na fila IndexedDB (`lib/client/queue.ts`) **antes** do upload, com um UUID
   gerado no navegador. O item só sai da fila quando o servidor devolve uma visita com status diferente de
   `processing`. A fila é reenviada ao abrir o app, ao logar e no evento `online`.
3. `POST /api/process` é idempotente em `(user_id, client_uuid)`: reenvio de visita já processada só devolve o
   resultado; visita com `error` (ou travada em `processing` há mais de 5 min) é reprocessada no mesmo registro. Chama
   `transcribe()` (áudio → texto) e depois `summarize()` (texto → JSON com `response_format` json_schema). O áudio
   nunca é persistido.
4. Ciclo de status: `processing` → `draft` (saída da IA) → `confirmed` (usuário revisou e salvou via
   `PUT /api/visits/[id]`), ou `error`.

**Formato do resumo** é definido em `src/lib/server/prompts.ts` (`SUMMARY_SCHEMA` + interface `AiSummary`, chaves em
português: `loja`, `gestor`, `resumo`, `impressoes`, `analises`, `acoes[{descricao, responsavel, prazo}]`).
`saveSummary()` em `visits.ts` distribui isso em `visits.store_name/manager_name`, `visits.summary_json`
(`{resumo, impressoes, analises}`) e linhas de `visit_actions` (`description/owner/due/done`). API e front-end usam os
nomes de coluna em inglês. Mudar o formato exige alterar `prompts.ts`, `visits.ts`, `lib/types.ts` e
`components/VisitReview.tsx`.

**Autorização:** cookie `visitas_session` (iron-session, guarda só `userId`; o usuário é relido do banco a cada
requisição, então desativar `users.active` corta o acesso). `role = avaliador` vê só as próprias visitas; `admin` vê
todas (aplicado em `findVisit()` / `listVisits()`). Requisições que alteram dados exigem o header
`X-Requested-With: fetch` (enviado por `lib/client/api.ts`) como proteção CSRF — use `assertFetchRequest()` em novas
rotas de escrita e envolva handlers com `handler()` de `lib/server/http.ts` para converter `HttpError` em JSON.

## Convenções e armadilhas

- **Build compatível com a Hostinger:** a glibc do servidor é antiga demais para o binário nativo do SWC
  (`GLIBC_2.29 not found`), então o Next cai para o SWC em WebAssembly. Por isso o config é `next.config.mjs`
  (não `.ts`, que precisa ser transpilado e falha com WASM) e o build usa `next build --webpack` (o Turbopack exige
  binário nativo). Não volte para `next.config.ts` nem remova o `--webpack`, e evite recursos que dependem do SWC
  nativo (ex.: `next/font`). O `next dev` local pode continuar com Turbopack.
- **Não crie `src/proxy.ts`/middleware que intercepte `/api/process`:** com proxy ativo o Next limita o corpo da
  requisição a 10 MB, e um WAV de 15 min tem ~29 MB.
- Limite de duração em dois lugares que devem coincidir: `MAX_AUDIO_SECONDS` (servidor) e
  `NEXT_PUBLIC_MAX_AUDIO_SECONDS` (navegador, embutido no build).
- Datas: o banco guarda DATETIME em horário de Brasília e o `mysql2` usa `dateStrings: true` (strings
  `"YYYY-MM-DD HH:MM:SS"`). O navegador envia ISO em UTC na gravação e `YYYY-MM-DDTHH:MM` local no formulário;
  `normalizeDate()` em `visits.ts` trata os dois casos.
- Service Worker (`public/sw.js`): cache-first para `/_next/static/`, network-first para o resto, nunca cacheia
  `/api/`. Aumente `CACHE_VERSION` ao mudar a estratégia ou a lista `PRECACHE`.
- Chamadas à OpenRouter sempre enviam `provider.data_collection = deny` (LGPD); mantenha em novas chamadas.
- SQL: use aspas simples em literais (aspas duplas quebram com `ANSI_QUOTES`).
- Textos da interface, prompts, comentários e documentação em português do Brasil; identificadores em inglês.
- Params de rotas dinâmicas são `Promise` no Next 16 (`await params`).

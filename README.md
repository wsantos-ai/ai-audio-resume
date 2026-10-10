# Resumo de Visitas

PWA para avaliadores de lojas: ao final da visita o usuário grava um áudio (loja, gestor, impressões, análises e ações),
o áudio é transcrito e resumido por um LLM via [OpenRouter](https://openrouter.ai/), e o resultado fica centralizado em MySQL.

Stack: Next.js 16 (App Router, TypeScript) + MySQL/MariaDB (`mysql2`) + sessão em cookie criptografado (`iron-session`).
Requer Node.js 22.9+.

## Estrutura

```
src/app/            Páginas (/, /historico, /visita/[id], /login), manifest e rotas da API (src/app/api)
src/components/     Componentes de tela (client components) e o AppProvider (estado global + fila offline)
src/lib/server/     Código só do servidor: config (env), banco, sessão, cliente OpenRouter, prompts, visitas
src/lib/client/     Código só do navegador: gravador WAV, fila IndexedDB, cliente da API
public/             Service Worker (sw.js), AudioWorklet (pcm-worklet.js) e ícones
database/           schema.sql
scripts/            create-user.mjs
```

## Desenvolvimento local

Requer um MySQL local.

```bash
npm install
cp .env.example .env.local                 # preencha banco, SESSION_SECRET e OPENROUTER_API_KEY
mysql -u root -p visitas < database/schema.sql
npm run create-user -- voce@exemplo.com "Seu Nome" admin
npm run dev                                # http://localhost:3000
```

O navegador libera microfone e Service Worker em `localhost` sem HTTPS. Para testar no celular, use HTTPS
(ex.: um túnel como `ngrok http 3000`).

Outros comandos: `npm run typecheck` (TypeScript) e `npm run build && npm start` (build de produção local).

## Deploy na Hostinger

É preciso um plano com **Node.js** (Business ou Cloud) ou um **VPS**. Planos compartilhados sem Node.js não rodam Next.js.

### Plano Business/Cloud (app Node.js gerenciado)

1. hPanel → Bancos de dados MySQL: crie o banco e o usuário; importe `database/schema.sql` pelo phpMyAdmin.
2. Crie um site do tipo Node.js apontando para o repositório GitHub (ou envie o projeto em .zip, sem `node_modules` e `.next`).
3. Configure: Node.js 22, comando de build `npm run build`, comando de início `npm start`.
4. Cadastre as variáveis de ambiente do `.env.example` no painel (`DB_*`, `SESSION_SECRET`, `OPENROUTER_*`, `APP_URL`
   com o domínio em HTTPS etc.).
5. Ative o SSL do domínio. HTTPS é obrigatório: sem ele o navegador bloqueia o microfone e o Service Worker.
6. Crie os usuários rodando `npm run create-user` com acesso ao banco (via SSH, ou localmente apontando o `.env.local`
   para o banco remoto, se o acesso remoto ao MySQL estiver liberado).

### VPS

`npm ci && npm run build`, depois mantenha `npm start` rodando com PM2 (ou systemd) atrás de um Nginx com HTTPS.
No Nginx, aumente `client_max_body_size` para 40M e `proxy_read_timeout` para 300s (upload e processamento do áudio).

## OpenRouter

- Os modelos ficam nas variáveis `OPENROUTER_MODEL_*`. O de transcrição precisa aceitar entrada de áudio; o de resumo
  precisa suportar `response_format` com `json_schema`. Padrão: `google/gemini-2.5-flash` para ambos.
- As requisições usam `provider.data_collection = deny` (só provedores que não retêm/treinam com os dados).
- O áudio não é salvo no servidor; apenas a transcrição e o resumo vão para o banco.

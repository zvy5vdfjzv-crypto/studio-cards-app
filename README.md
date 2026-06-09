# ESTÚDIO DE CARDS

Gerador de cards de redes sociais (notícia/fofoca) — templates + lote + publicação. Evoluído do protótipo `estudio-de-cards.html` para um app web com backend, multi-conta e publicação legítima.

## O que faz
- **Criar template:** upload da arte-base, marcação por arrasto da zona de foto e dos textos (fonte/cor/alinhamento/tamanho), upload de fonte e logo.
- **Conteúdo (IA):** chama a Anthropic com `web_search` **no servidor** (a chave nunca vai ao browser) e redige manchetes **originais**.
- **Gerar cards:** entrada em massa, busca de foto em cascata e exporta PNG/ZIP. Render fiel ao protótipo (foto na zona → arte por cima → textos).
- **Publicar:** Instagram Graph API (Content Publishing) para contas Business/Creator.

## Arquitetura
- **Next.js 14 (App Router) + TypeScript** — backend = route handlers, front = React.
- **Postgres** (Neon/Supabase) — contas, canais, templates, histórico.
- **Vercel Blob** — arte/fonte/logo e o PNG final (URL pública necessária p/ publicar).
- **Proxy de IA** (`/api/ai/generate`) e **proxy de imagem same-origin** (`/api/image/proxy`, URL assinada anti-SSRF) — resolve CORS para o canvas exportar de qualquer fonte.

## Restrições (por quê)
- **Imagens:** só fontes licenciadas/CC com API (Pexels/Unsplash/Openverse), Wikimedia/Wikipedia ou upload — sempre com crédito. Sem Google Imagens, Pinterest ou portais de notícia.
- **Publicação:** só vias oficiais (Instagram Graph API). Sem scraping/automação de tela.
- **Texto da IA:** sempre original; nunca copia trechos das matérias.

## Setup local
```bash
npm install
cp .env.example .env.local   # preencha as variáveis
DATABASE_URL='postgres://...' npm run db:init   # cria o schema
npm run dev
```

## Variáveis de ambiente
Veja `.env.example`. Mínimo para rodar: `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`.
Para publicar: `BLOB_READ_WRITE_TOKEN` + `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET`.
Para Drive: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.

## Deploy (Vercel)
1. Importe o repo na Vercel.
2. Configure as env vars (inclusive `APP_URL` = URL de produção).
3. Crie um Postgres (Neon/Supabase) e um store **Vercel Blob**.
4. Rode `npm run db:init` apontando para o `DATABASE_URL` de produção (uma vez).
5. No app do Facebook, registre os redirect URIs:
   - `https://SEU_DOMINIO/api/instagram/callback`
   - `https://SEU_DOMINIO/api/drive/callback` (no Google Cloud Console)

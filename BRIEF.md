# ESTÚDIO DE CARDS — brief do projeto

## O que é
App web (Next.js 14, App Router + TypeScript) que gera cards de redes sociais para um
canal de notícia/fofoca. A partir de uma entrada em massa (uma manchete por linha), ele
monta cards: foto na zona marcada (clip + "cover") → arte-base PNG com janela transparente
por cima → textos com auto-fit em cima. Render é em `<canvas>`
(`components/canvas.ts` → `renderCard`/`wrapL`). O builder (`BuilderTab.tsx`) marca zonas de
texto/foto por arrasto em coordenadas normalizadas 0–1. Export PNG/ZIP (JSZip).
Recém-adicionado: ajuste de foto por card (zoom + foco horizontal/vertical) pra não cortar rosto.

## Arquitetura
- Front em React (`components/`: `Studio.tsx`, `GeneratorTab.tsx`, `BuilderTab.tsx`,
  `ChannelBar.tsx`, `AiTab.tsx`).
- Backend = route handlers em `app/api/*`.
- Banco: Postgres (Supabase, pooler porta 6543) via `pg`.
- Modo "dono único": sem tela de login; usuário `owner@local` auto-criado (`lib/auth.ts`).
  **Não reintroduzir login.**
- Feature flags por presença de env var (`features: {ai, instagram, drive}`): se a chave
  não existe, o botão/aba some. O app tem que funcionar 100% **sem nenhuma chave de terceiro**.
- Deploy: Vercel; assets (arte/fonte/logo) em Vercel Blob.
- Busca de foto em cascata: Wikipedia → Wikimedia Commons → Openverse → Pexels/Unsplash →
  upload, sempre com crédito automático. Proxy de imagem same-origin pra resolver CORS do canvas.

## Restrições INEGOCIÁVEIS (não sugerir nada que quebre isto)
1. **Imagens** só de fontes licenciadas/CC com API (Pexels, Unsplash, Openverse),
   Wikimedia/Wikipedia ou upload do usuário — **sempre com crédito**. NUNCA Google Imagens,
   Pinterest ou raspagem de portais de notícia.
2. **Publicação** só por vias oficiais: Instagram Graph API (contas Business/Creator) ou
   serviço licenciado tipo Ayrshare. NUNCA scraping/automação de tela (mLabs etc.) nem
   bypass de captcha/bot-detection.
3. **Texto de IA sempre ORIGINAL** — resumir com palavras próprias, nunca copiar trechos de matérias.
4. Segredos (senha do banco, tokens, `SESSION_SECRET`) nunca no código nem em repositório —
   só em `.env.local` (gitignored) e no painel da Vercel.

## O que eu quero do refino
Melhorar UX/visual e qualidade do código **respeitando as 4 restrições acima**.
Não adicionar login, não adicionar fontes de imagem proibidas, não adicionar automação de
publicação não-oficial.

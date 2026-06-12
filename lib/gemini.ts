// Assistente de chat via Google Gemini (camada grátis). A chave fica SÓ no servidor.
// O assistente conversa e pode disparar uma ação no app (gerar um lote de cards).
// Texto sempre ORIGINAL; nunca copia trechos de matérias; nunca inventa fato.

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantLine {
  texto: string;
  foto?: string;
  fonte?: string;
}

export type AssistantAction =
  | null
  | { type: "gerar"; template: string | null; linhas: AssistantLine[] };

export interface AssistantResult {
  reply: string;
  action: AssistantAction;
}

export async function chatAssistant(opts: {
  messages: AssistantTurn[];
  templates: string[];
}): Promise<AssistantResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada no servidor.");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const today = new Date().toLocaleDateString("pt-BR");
  const tplList = opts.templates.length ? opts.templates.join(", ") : "(nenhum)";

  const sys =
    `Você é o assistente do "Estúdio de Cards", um app que cria cards de redes sociais para um canal de notícia/fofoca. Hoje é ${today}.\n` +
    `Você AJUDA o usuário: sugere pautas e manchetes, escreve os textos dos cards e pode DISPARAR a geração de um lote de cards dentro do app.\n\n` +
    `REGRAS INEGOCIÁVEIS:\n` +
    `- Toda manchete é ORIGINAL, escrita com suas próprias palavras, resumindo o fato. NUNCA copie frases, trechos ou títulos de matérias.\n` +
    `- Manchete curta: no máximo ~14 palavras.\n` +
    `- O campo "foto" é o nome simples da pessoa/assunto (ex.: "Taylor Swift") — o app busca a imagem sozinho em fontes licenciadas/CC com crédito. NÃO invente links nem mande usar Google Imagens/Pinterest.\n` +
    `- NUNCA invente fatos. Se não tiver a informação (você não navega na web), peça ao usuário para colar a notícia/os fatos, em vez de inventar.\n` +
    `- Você NÃO altera o código do app; só conversa e dispara ações já existentes.\n\n` +
    `Templates disponíveis no canal: ${tplList}.\n\n` +
    `FORMATO: responda SEMPRE com UM único objeto JSON puro (sem markdown, sem texto fora do JSON):\n` +
    `{"reply":"sua mensagem em português","action":null}\n` +
    `Quando — e somente quando — o usuário pedir para CRIAR/GERAR cards e você tiver os fatos necessários, use:\n` +
    `{"reply":"confirmação curta do que vai gerar","action":{"type":"gerar","template":"um nome da lista ou null","linhas":[{"texto":"manchete original","foto":"nome p/ foto","fonte":"veículo curto"}]}}\n` +
    `No máximo 12 linhas. Se faltar informação, mantenha action=null e pergunte.`;

  const contents = opts.messages
    .filter((m) => m.content && m.content.trim())
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const body = {
    system_instruction: { parts: [{ text: sys }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048, responseMimeType: "application/json" },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || "Erro da API Gemini.");

  const txt = (data.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p.text || "")
    .join("")
    .trim();

  let parsed: any = null;
  try {
    const m = txt.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : txt);
  } catch {
    parsed = { reply: txt || "Desculpa, não consegui responder agora. Tenta de novo?", action: null };
  }

  const reply = String(parsed?.reply || "").trim() || "Certo!";
  let action: AssistantAction = null;
  const a = parsed?.action;
  if (a && a.type === "gerar" && Array.isArray(a.linhas)) {
    const linhas: AssistantLine[] = a.linhas
      .map((l: any) => ({
        texto: String(l?.texto || "").trim(),
        foto: l?.foto ? String(l.foto).trim() : undefined,
        fonte: l?.fonte ? String(l.fonte).trim() : undefined,
      }))
      .filter((l: AssistantLine) => l.texto)
      .slice(0, 12);
    if (linhas.length) {
      action = { type: "gerar", template: a.template ? String(a.template).trim() : null, linhas };
    }
  }

  return { reply, action };
}

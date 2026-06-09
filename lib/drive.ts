import { appUrl } from "./oauth";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export function driveRedirectUri() {
  return `${appUrl()}/api/drive/callback`;
}

export function driveAuthUrl(state: string) {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID não configurado.");
  const p = new URLSearchParams({
    client_id: id,
    redirect_uri: driveRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // força refresh_token
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function driveExchange(code: string): Promise<{ refreshToken: string }> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: driveRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error_description || d.error);
  if (!d.refresh_token) throw new Error("Google não retornou refresh_token (revogue o acesso e reconecte).");
  return { refreshToken: d.refresh_token };
}

async function accessToken(refreshToken: string): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error_description || d.error);
  return d.access_token as string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export async function listFolder(refreshToken: string, folderId: string): Promise<DriveFile[]> {
  const token = await accessToken(refreshToken);
  const u = new URL("https://www.googleapis.com/drive/v3/files");
  u.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
  u.searchParams.set("fields", "files(id,name,mimeType)");
  u.searchParams.set("pageSize", "100");
  const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Erro ao listar a pasta.");
  return d.files || [];
}

export async function download(refreshToken: string, fileId: string): Promise<{ buf: Buffer; mime: string }> {
  const token = await accessToken(refreshToken);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Falha ao baixar arquivo do Drive.");
  const mime = r.headers.get("content-type") || "application/octet-stream";
  return { buf: Buffer.from(await r.arrayBuffer()), mime };
}

// Classifica os arquivos da pasta do canal: fonte, logo e cores.json.
export function classify(files: DriveFile[]) {
  const isFont = (f: DriveFile) => /\.(ttf|otf|woff2?|)$/i.test(f.name) && /font|otf|ttf|woff/i.test(f.name + f.mimeType);
  const font = files.find((f) => /\.(ttf|otf|woff2?)$/i.test(f.name)) || files.find(isFont) || null;
  const logo =
    files.find((f) => /logo/i.test(f.name) && /image\//.test(f.mimeType)) ||
    files.find((f) => /image\/(png|svg)/.test(f.mimeType)) ||
    null;
  const colors = files.find((f) => /(colors?|cores)\.json$/i.test(f.name)) || null;
  return { font, logo, colors };
}

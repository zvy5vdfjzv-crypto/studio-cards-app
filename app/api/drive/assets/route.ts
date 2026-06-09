import { handler, ok } from "@/lib/http";
import { requireUser, ownedChannel } from "@/lib/auth";
import { query } from "@/lib/db";
import { upload } from "@/lib/blob";
import { listFolder, download, classify } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

// Lê a pasta do canal no Drive e importa fonte/logo/cores p/ o template.
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { channelId, folderId } = await req.json();
  const ch: any = await ownedChannel(user.id, channelId);
  if (!ch.drive_refresh_token) throw new Error("Canal não conectado ao Google Drive.");
  const fid = String(folderId || ch.drive_folder_id || "").trim();
  if (!fid) throw new Error("Informe o ID da pasta do Drive.");

  await query("UPDATE channels SET drive_folder_id=$1 WHERE id=$2", [fid, channelId]);

  const files = await listFolder(ch.drive_refresh_token, fid);
  const { font, logo, colors } = classify(files);

  let fontUrl: string | null = null,
    fontName: string | null = null,
    logoUrl: string | null = null,
    palette: any = null;

  if (font) {
    const { buf, mime } = await download(ch.drive_refresh_token, font.id);
    const up = await upload(`${channelId}/font/${font.name}`, buf, mime || "font/ttf");
    fontUrl = up.url;
    fontName = font.name;
  }
  if (logo) {
    const { buf, mime } = await download(ch.drive_refresh_token, logo.id);
    const up = await upload(`${channelId}/logo/${logo.name}`, buf, mime || "image/png");
    logoUrl = up.url;
  }
  if (colors) {
    try {
      const { buf } = await download(ch.drive_refresh_token, colors.id);
      palette = JSON.parse(buf.toString("utf8"));
    } catch {}
  }

  return ok({
    fontUrl,
    fontName,
    logoUrl,
    colors: palette,
    files: files.map((f) => ({ name: f.name, mimeType: f.mimeType })),
  });
});

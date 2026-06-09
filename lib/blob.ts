import { put } from "@vercel/blob";

const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Sobe um buffer/arquivo e devolve URL pública.
// Sem token do Blob: cai para data URL (funciona, mas não serve p/ publicar no Instagram).
export async function upload(
  key: string,
  data: Buffer | Uint8Array | ArrayBuffer,
  contentType: string
): Promise<{ url: string; persisted: boolean }> {
  const buf = data instanceof Buffer ? data : Buffer.from(data as any);
  if (hasBlob()) {
    const blob = await put(key, buf, {
      access: "public",
      contentType,
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: blob.url, persisted: true };
  }
  const b64 = buf.toString("base64");
  return { url: `data:${contentType};base64,${b64}`, persisted: false };
}

export function isPublicUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

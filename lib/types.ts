// Estruturas compartilhadas entre front (canvas) e back (persistência).

export interface TextZone {
  key: string;
  sample: string;
  font: string;
  weight: number;
  color: string;
  align: "left" | "center" | "right";
  lh: number;
  upper: boolean;
  sizeMode: "auto" | "fixed";
  sizePx: number;
  x: number; // 0..1 normalizado
  y: number;
  w: number;
  h: number;
}

export interface PhotoZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

// O objeto de template editável. `frame`/`fontData` são URLs (Blob) ou data URLs (fallback).
export interface TemplateData {
  name: string;
  frame: string; // url da arte-base (PNG)
  w: number;
  h: number;
  photoBehind: boolean;
  gray: boolean;
  fontData: string | null; // url ou data url da fonte custom
  fontName?: string | null;
  logo?: string | null; // url do logo (opcional, do Drive)
  photoZone: PhotoZone | null;
  textZones: TextZone[];
}

export interface TemplateRecord {
  id: string;
  channel_id: string;
  name: string;
  data: TemplateData;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  ig_user_id: string | null;
  ig_username: string | null;
  ig_page_id: string | null;
  ig_token_expires_at: string | null;
  drive_folder_id: string | null;
  drive_connected: boolean;
  created_at: string;
}

export interface ImageResult {
  url: string; // url ORIGINAL na fonte (usar via /api/image/proxy no canvas)
  thumb: string;
  author: string;
  lic: string;
  source: string; // wikimedia | wikipedia | openverse | pexels | unsplash
  bad?: boolean;
}

export interface AiCard {
  title: string;
  source: string;
  photo_query: string;
}

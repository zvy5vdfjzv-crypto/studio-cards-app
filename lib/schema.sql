-- Schema do ESTÚDIO DE CARDS (Postgres). Idempotente.

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  name        text NOT NULL DEFAULT '',
  pass_hash   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token       text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               text NOT NULL,
  slug               text NOT NULL,
  -- Instagram Graph
  ig_user_id         text,
  ig_username        text,
  ig_page_id         text,
  ig_access_token    text,
  ig_token_expires_at timestamptz,
  -- Google Drive
  drive_folder_id    text,
  drive_refresh_token text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  name        text NOT NULL,
  data        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_channel_idx ON templates(channel_id);

CREATE TABLE IF NOT EXISTS assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  kind        text NOT NULL,             -- frame | font | logo | card
  filename    text NOT NULL DEFAULT '',
  mime        text NOT NULL DEFAULT '',
  url         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  template_id   uuid REFERENCES templates(id) ON DELETE SET NULL,
  title         text NOT NULL DEFAULT '',
  photo_credit  text NOT NULL DEFAULT '',
  photo_source  text NOT NULL DEFAULT '',
  image_url     text,                    -- url pública do PNG final (Blob)
  ig_media_id   text,
  ig_published  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS history_channel_idx ON history(channel_id, created_at DESC);

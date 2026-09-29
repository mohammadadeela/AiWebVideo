-- Published examples are reusable media, independent of the jobs they inspire.
CREATE TABLE IF NOT EXISTS inspiration_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_seconds NUMERIC(10,2),
  sha256 TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  admin_title TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inspiration_media_public_idx ON inspiration_media(status, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS inspiration_media_type_idx ON inspiration_media(media_type, status);

CREATE TABLE IF NOT EXISTS inspiration_features (
  media_id UUID NOT NULL REFERENCES inspiration_media(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL CHECK (feature_id IN ('website', 'video', 'photo', 'product-video', 'scenario', 'interior', 'architecture')),
  PRIMARY KEY (media_id, feature_id)
);
CREATE INDEX IF NOT EXISTS inspiration_features_feature_idx ON inspiration_features(feature_id, media_id);

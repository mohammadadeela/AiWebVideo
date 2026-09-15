-- AiWebVideo Studio — additive, non-destructive schema.
-- Existing generation/jobs/assets/payment tables are intentionally untouched.

CREATE TABLE IF NOT EXISTS studio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled project',
  kind TEXT NOT NULL DEFAULT 'video' CHECK (kind IN ('video','image')),
  width INTEGER NOT NULL DEFAULT 1080 CHECK (width BETWEEN 64 AND 8192),
  height INTEGER NOT NULL DEFAULT 1920 CHECK (height BETWEEN 64 AND 8192),
  aspect_ratio TEXT NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('16:9','9:16','1:1')),
  duration_seconds NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  project_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  latest_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS studio_projects_user_updated_idx ON studio_projects(user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS studio_projects_source_job_idx ON studio_projects(source_job_id) WHERE source_job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS studio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('video','image','audio','logo','generated','screenshot')),
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  source_url TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds NUMERIC(12,3),
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS studio_assets_project_idx ON studio_assets(project_id, created_at);
CREATE INDEX IF NOT EXISTS studio_assets_user_idx ON studio_assets(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS studio_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT 'Project update',
  project_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, revision)
);
CREATE INDEX IF NOT EXISTS studio_revisions_project_idx ON studio_revisions(project_id, revision DESC);

CREATE TABLE IF NOT EXISTS studio_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','preparing','rendering','encoding','uploading','completed','failed','cancelled')),
  resolution TEXT NOT NULL DEFAULT '720p' CHECK (resolution IN ('720p','1080p','4k')),
  format TEXT NOT NULL DEFAULT 'mp4' CHECK (format IN ('mp4','png','jpg')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_url TEXT,
  error TEXT,
  render_time_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS studio_exports_user_idx ON studio_exports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS studio_exports_status_idx ON studio_exports(status, created_at);

CREATE TABLE IF NOT EXISTS studio_ai_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  execution_kind TEXT NOT NULL CHECK (execution_kind IN ('local','paid')),
  provider TEXT,
  model TEXT,
  instruction_hash TEXT,
  commands JSONB NOT NULL DEFAULT '[]'::jsonb,
  reserved_credits INTEGER NOT NULL DEFAULT 0 CHECK (reserved_credits >= 0),
  final_credits INTEGER NOT NULL DEFAULT 0 CHECK (final_credits >= 0),
  estimated_cost_usd NUMERIC(14,8) NOT NULL DEFAULT 0,
  actual_cost_usd NUMERIC(14,8) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','reserved','running','completed','failed','cancelled')),
  billing_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  output_asset_id UUID REFERENCES studio_assets(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS studio_ai_operations_project_idx ON studio_ai_operations(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS studio_ai_operations_user_idx ON studio_ai_operations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS studio_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES studio_projects(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  idea_id TEXT,
  feature TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS studio_events_created_idx ON studio_events(created_at DESC);
CREATE INDEX IF NOT EXISTS studio_events_idea_idx ON studio_events(idea_id, event, created_at DESC) WHERE idea_id IS NOT NULL;

INSERT INTO system_settings (key, value) VALUES
  ('studio', '{"enabled":true,"aiEditEnabled":true,"aiImagesEnabled":true,"aiVideoEnabled":true,"transcriptionEnabled":true,"backgroundRemovalEnabled":true,"upscaleEnabled":true,"premiumExportEnabled":true,"fourKExportEnabled":false,"prices":{"generateImage":4,"editImage":3,"removeBackground":1,"eraseObject":3,"replaceBackground":4,"upscale":2,"transcribe":2}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

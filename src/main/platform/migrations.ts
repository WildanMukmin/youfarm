/** Tambah migrasi baru di AKHIR daftar. Jangan ubah yang sudah ada. Tanpa Electron, jadi bisa dipakai tes. */
export const MIGRATIONS: string[] = [
  `CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,

  `CREATE TABLE uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    template TEXT,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    playlist_id TEXT,
    input_json TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    not_before TEXT,
    error_kind TEXT,
    error_message TEXT,
    warning TEXT,
    video_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX uploads_status ON uploads (status, id)`,

  `CREATE TABLE production_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    topic TEXT NOT NULL,
    options_json TEXT NOT NULL,
    publish_json TEXT,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    warning TEXT,
    title TEXT,
    result_json TEXT,
    upload_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
  );
  CREATE INDEX production_status ON production_jobs (status, id)`,

  `CREATE TABLE footage (
    provider TEXT NOT NULL,
    id INTEGER NOT NULL,
    path TEXT NOT NULL,
    duration REAL NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    phrases_json TEXT NOT NULL DEFAULT '[]',
    uses INTEGER NOT NULL DEFAULT 0,
    last_seq INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    PRIMARY KEY (provider, id)
  )`
]

-- Users 表：存储 OAuth 用户信息
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    avatar TEXT,
    provider TEXT NOT NULL, -- 'github'
    provider_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, provider_id);

-- Images 表：存储图片元数据
CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL, -- 原始文件名
    storage_key TEXT NOT NULL, -- R2 存储的 key
    file_size INTEGER NOT NULL, -- 文件大小（字节）
    width INTEGER, -- 图片宽度
    height INTEGER, -- 图片高度
    format TEXT NOT NULL, -- 文件格式：jpeg, png, gif, webp 等
    mime_type TEXT NOT NULL, -- MIME 类型
    is_compressed INTEGER NOT NULL DEFAULT 0, -- 是否压缩过（0=否, 1=是）
    compression_quality REAL, -- 压缩质量（0.1-1.0）
    original_size INTEGER, -- 压缩前的原始大小
    url TEXT NOT NULL, -- 访问 URL
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_created_at ON images(created_at DESC);
CREATE INDEX idx_images_format ON images(format);
CREATE INDEX idx_images_storage_key ON images(storage_key);

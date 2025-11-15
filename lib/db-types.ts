// Database types for D1
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: 'github' | 'password';
  provider_id: string;
  password_hash: string | null;
  created_at: number;
  updated_at: number;
}

export interface Image {
  id: string;
  user_id: string;
  filename: string;
  storage_key: string;
  file_size: number;
  width: number | null;
  height: number | null;
  format: string;
  mime_type: string;
  is_compressed: 0 | 1;
  compression_quality: number | null;
  original_size: number | null;
  url: string;
  created_at: number;
}

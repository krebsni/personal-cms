export interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  COLLABORATION_ROOM: DurableObjectNamespace;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

// User type matching database schema
export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: "admin" | "user";
  created_at: number;
  updated_at: number;
}

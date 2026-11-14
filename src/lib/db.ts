import mongoose from 'mongoose';

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { _mongoose?: Cache };
const cache: Cache = g._mongoose || (g._mongoose = { conn: null, promise: null });

// Connection details come only from the environment (.env.local); never hard-code credentials here.
// Read lazily so scripts that call dotenv.config() after their imports (scripts/seed.ts) still work.
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  if (cache.conn) return cache.conn;
  cache.promise ||= mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'eodc', bufferCommands: false })
    .catch((e) => { cache.promise = null; throw e; });
  cache.conn = await cache.promise;
  return cache.conn;
}

import { Db, MongoClient } from "mongodb";

type GlobalMongoCache = {
  clientId: string;
  client: MongoClient;
  clientPromise: Promise<MongoClient>;
};

const globalForMongo = globalThis as typeof globalThis & {
  __mongoCache?: GlobalMongoCache;
};

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI in environment variables.");
  }

  return uri;
}

function extractDbName(connectionUri: string): string {
  try {
    const parsed = new URL(connectionUri);
    const dbName = parsed.pathname.replace("/", "").trim();
    return dbName || "unispot";
  } catch {
    const match = connectionUri.match(/^[^/]+\/\/[^/]+\/([^?]+)/);
    return match?.[1]?.trim() || "unispot";
  }
}

function getOrCreateCache(): GlobalMongoCache {
  const existingCache = globalForMongo.__mongoCache;
  if (existingCache) {
    return existingCache;
  }

  const uri = getMongoUri();
  const client = new MongoClient(uri);
  const newCache: GlobalMongoCache = {
    clientId: `mongo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    client,
    clientPromise: client.connect(),
  };

  // Always cache globally so every request/session uses the same MongoClient instance.
  globalForMongo.__mongoCache = newCache;

  return newCache;
}

export function getMongoClient(): Promise<MongoClient> {
  return getOrCreateCache().clientPromise;
}

export function getClient(): Promise<MongoClient> {
  return getMongoClient();
}

export function getDb(): Db {
  const uri = getMongoUri();
  const dbName = extractDbName(uri);
  return getOrCreateCache().client.db(dbName);
}

export function getMongoClientId(): string {
  return getOrCreateCache().clientId;
}

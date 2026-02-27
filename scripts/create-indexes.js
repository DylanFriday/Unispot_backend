function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }
  return uri;
}

function getDbNameFromUri(uri) {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname.replace("/", "").trim();
    return dbName || "unispot";
  } catch {
    return "unispot";
  }
}

async function main() {
  const { MongoClient } = await import("mongodb");
  const uri = getMongoUri();
  const dbName = getDbNameFromUri(uri);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const payments = db.collection("payments");
    const reports = db.collection("reports");

    await payments.createIndexes([
      { key: { sellerId: 1, createdAt: -1 } },
      { key: { sellerId: 1, status: 1, createdAt: -1 } },
    ]);

    await reports.createIndexes([
      { key: { status: 1, createdAt: -1 } },
      { key: { targetType: 1, targetId: 1, status: 1, createdAt: -1 } },
      {
        key: { reporterId: 1, targetType: 1, targetId: 1, status: 1 },
        unique: true,
        partialFilterExpression: { status: "PENDING" },
      },
    ]);

    console.log(`Indexes created successfully on ${dbName}.payments and ${dbName}.reports`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to create indexes: ${message}`);
  process.exit(1);
});

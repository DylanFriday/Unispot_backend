import { MongoClient, type IndexDescription } from "mongodb";

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }
  return uri;
}

function getDbNameFromUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname.replace("/", "").trim();
    return dbName || "unispot";
  } catch {
    return "unispot";
  }
}

const indexPlan: Record<string, IndexDescription[]> = {
  users: [{ key: { email: 1 }, unique: true }],
  courses: [{ key: { code: 1 }, unique: true }],
  teachers: [{ key: { name: 1 }, unique: true }],
  course_teachers: [{ key: { courseId: 1, teacherId: 1 }, unique: true }],
  study_sheets: [
    { key: { status: 1, createdAt: -1 } },
    { key: { courseCode: 1, status: 1, createdAt: -1 } },
    { key: { ownerId: 1, createdAt: -1 } },
  ],
  study_sheet_approvals: [{ key: { studySheetId: 1 }, unique: true }],
  purchases: [
    { key: { studySheetId: 1, buyerId: 1 }, unique: true },
    { key: { buyerId: 1, createdAt: -1 } },
  ],
  payments: [
    { key: { purchaseId: 1 }, unique: true },
    { key: { referenceCode: 1 }, unique: true },
    { key: { status: 1, createdAt: -1 } },
    { key: { sellerId: 1, status: 1 } },
  ],
  lease_listings: [
    { key: { status: 1, createdAt: -1 } },
    { key: { ownerId: 1, createdAt: -1 } },
  ],
  lease_approvals: [{ key: { leaseListingId: 1 }, unique: true }],
  interest_requests: [{ key: { leaseListingId: 1, studentId: 1 }, unique: true }],
  reviews: [
    { key: { studentId: 1, courseId: 1 }, unique: true },
    { key: { courseId: 1, status: 1, createdAt: -1 } },
    { key: { status: 1, createdAt: -1 } },
  ],
  review_votes: [{ key: { reviewId: 1, voterId: 1 }, unique: true }],
  review_reports: [{ key: { reviewId: 1, reporterId: 1 }, unique: true }],
  review_history: [{ key: { reviewId: 1, createdAt: -1 } }],
  teacher_reviews: [
    { key: { courseId: 1, status: 1, createdAt: -1 } },
    { key: { status: 1, createdAt: -1 } },
    { key: { courseId: 1, teacherId: 1, status: 1, createdAt: -1 } },
  ],
  teacher_review_votes: [{ key: { teacherReviewId: 1, voterId: 1 }, unique: true }],
  teacher_review_reports: [{ key: { teacherReviewId: 1, reporterId: 1 }, unique: true }],
  teacher_review_history: [{ key: { teacherReviewId: 1, createdAt: -1 } }],
  withdrawal_requests: [
    { key: { sellerId: 1, createdAt: -1 } },
    { key: { status: 1, createdAt: -1 } },
  ],
  audit_logs: [
    { key: { entityType: 1, createdAt: -1 } },
    { key: { actorId: 1, createdAt: -1 } },
    { key: { entityType: 1, entityId: 1 } },
  ],
};

async function main(): Promise<void> {
  const uri = getMongoUri();
  const dbName = getDbNameFromUri(uri);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    for (const [collectionName, indexes] of Object.entries(indexPlan)) {
      if (indexes.length === 0) continue;
      const result = await db.collection(collectionName).createIndexes(indexes);
      console.log(`${collectionName}: ${result.join(", ")}`);
    }

    console.log(`Index creation complete on db "${dbName}"`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to create indexes: ${message}`);
  process.exit(1);
});

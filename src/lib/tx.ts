import { type ClientSession, type Db } from "mongodb";

import { getDb, getMongoClient, getMongoClientId } from "@/lib/db";

type TransactionHandler<T> = (session: ClientSession, db: Db) => Promise<T>;

type TransactionContext = {
  requestId?: string;
  route?: string;
};

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  code?: unknown;
  cause?: unknown;
};

function toErrorLike(error: unknown): ErrorLike {
  if (!error || typeof error !== "object") {
    return {};
  }
  return error as ErrorLike;
}

export async function withTransaction<T>(
  handler: TransactionHandler<T>,
  context?: TransactionContext,
): Promise<T> {
  const client = await getMongoClient();
  const db = getDb();
  const clientId = getMongoClientId();
  const session = client.startSession();
  console.info({
    requestId: context?.requestId ?? "unknown-request-id",
    route: context?.route ?? "unknown-route",
    message: "Transaction session created",
    mongoClientId: clientId,
  });

  try {
    session.startTransaction();
    const result = await handler(session, db);
    await session.commitTransaction();
    return result;
  } catch (err) {
    const txErr = toErrorLike(err);

    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch {
      // Ignore abort failure; original failure is more important.
    }

    console.error({
      requestId: context?.requestId ?? "unknown-request-id",
      route: context?.route ?? "unknown-route",
      errorName: txErr.name,
      errorMessage: txErr.message,
      errorStack: txErr.stack,
      errorCode: txErr.code,
      cause: txErr.cause,
    });

    if (err instanceof Response) {
      throw err;
    }

    throw new Error("Transaction failed due to an unexpected server error");
  } finally {
    await session.endSession();
  }
}

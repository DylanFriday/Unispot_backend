import { z, type ZodTypeAny } from "zod";

import { apiError } from "@/lib/errors";

export async function validateJson<TSchema extends ZodTypeAny>(
  req: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    throw apiError(400, "Invalid JSON body", "Bad Request");
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw apiError(
      400,
      result.error.issues[0]?.message ?? "Validation failed",
      "Bad Request",
    );
  }

  return result.data;
}

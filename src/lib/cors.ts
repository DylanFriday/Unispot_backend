const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

type RequestLike = {
  headers: Headers;
};

function parseOrigins(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function buildAllowedOrigins(): Set<string> {
  const allowed = new Set(DEFAULT_ALLOWED_ORIGINS);

  for (const origin of parseOrigins(process.env.CORS_ORIGINS)) {
    allowed.add(origin);
  }

  const legacyOrigin = process.env.CORS_ORIGIN?.trim();
  if (legacyOrigin) {
    allowed.add(legacyOrigin);
  }

  return allowed;
}

export function buildCorsHeaders(req: RequestLike): Headers {
  const headers = new Headers();
  const origin = req.headers.get("origin");
  const allowedOrigins = buildAllowedOrigins();

  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type,Accept,Origin",
  );
  headers.set("Access-Control-Max-Age", "86400");

  return headers;
}

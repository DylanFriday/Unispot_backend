const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

type RequestLike = {
  headers: Headers;
};

export function buildCorsHeaders(req: RequestLike): Headers {
  const headers = new Headers();
  const origin = req.headers.get("origin");
  const allowOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;

  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type,Accept,Origin",
  );

  return headers;
}

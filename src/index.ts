type MetricDTO = {
  video_id: string;
  time: number;
};

type QuizMetricDTO = {
  quiz_id: string;
  score: number;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    if (pathname === "/metric" && method === "POST") {
      return handleMetricPost(request, env);
    }

    if (pathname.startsWith("/metric/") && method === "GET") {
      return auth(() => handleMetricGet(request, env), request, env);
    }

    if (pathname === "/quiz_metric" && method === "POST") {
      return handleQuizMetricPost(request, env);
    }

    if (pathname.startsWith("/quiz_metric/") && method === "GET") {
      return auth(() => handleQuizMetricGet(request, env), request, env);
    }

    return new Response("not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;

/* ------------------------------------------------------------
    AUTH (Bearer Token)
-------------------------------------------------------------*/
async function auth(handler: Function, request: Request, env: Env) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("unauthorized", { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  if (token !== "promosium@sexo@metrics") {
    return new Response("forbidden", { status: 403 });
  }

  return handler();
}

/* ------------------------------------------------------------
    POST /metric — salva tempo assistido
-------------------------------------------------------------*/
async function handleMetricPost(request: Request, env: Env) {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const body = (await request.json()) as MetricDTO;

  if (!body.video_id || typeof body.time !== "number") {
    return new Response("invalid payload", { status: 400 });
  }

  const clientIP =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";

  const ipHash = await hash(clientIP + body.video_id);

  await env.DB.prepare(
    `
    INSERT INTO metrics (ip_hash, video_id, last_watch_time)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(ip_hash, video_id)
    DO UPDATE SET
      last_watch_time = MAX(last_watch_time, excluded.last_watch_time),
      updated_at = strftime('%s','now')
    `
  ).bind(ipHash, body.video_id, body.time).run();

  return new Response("ok", { status: 201 });
}

/* ------------------------------------------------------------
    POST /quiz_metric — salva métricas de quiz
-------------------------------------------------------------*/
async function handleQuizMetricPost(request: Request, env: Env) {
  const body = (await request.json()) as QuizMetricDTO;

  if (!body.quiz_id || typeof body.score !== "number") {
    return new Response("invalid payload", { status: 400 });
  }

  const clientIP =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";

  const ipHash = await hash(clientIP + body.quiz_id);

  await env.DB.prepare(
    `
    INSERT INTO quiz_metrics (ip_hash, quiz_id, score)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(ip_hash, quiz_id)
    DO UPDATE SET
      score = MAX(score, excluded.score),
      updated_at = strftime('%s','now')
    `
  ).bind(ipHash, body.quiz_id, body.score).run();

  return new Response("ok", { status: 201 });
}

/* ------------------------------------------------------------
    GET /metric/:video_id — retorna métricas do vídeo
-------------------------------------------------------------*/
async function handleMetricGet(request: Request, env: Env) {
  const video_id = request.url.split("/metric/")[1];

  const result = await env.DB.prepare(
    `SELECT ip_hash, last_watch_time, updated_at
     FROM metrics
     WHERE video_id = ?1
     ORDER BY updated_at ASC`
  ).bind(video_id).all();

  return Response.json(result.results ?? []);
}

/* ------------------------------------------------------------
    GET /quiz_metric/:quiz_id — retorna métricas de quiz
-------------------------------------------------------------*/
async function handleQuizMetricGet(request: Request, env: Env) {
  const quiz_id = request.url.split("/quiz_metric/")[1];

  const result = await env.DB.prepare(
    `SELECT ip_hash, score, updated_at
     FROM quiz_metrics
     WHERE quiz_id = ?1
     ORDER BY updated_at ASC`
  ).bind(quiz_id).all();

  return Response.json(result.results ?? []);
}

/* ------------------------------------------------------------
    HASH Utility (SHA-256 + base64)
-------------------------------------------------------------*/
async function hash(str: string) {
  const encoded = new TextEncoder().encode(str);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
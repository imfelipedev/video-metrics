type BodyDTO = {
  video_id: string;
  time: number;
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("method not allowed", { 
        status: 405 
      });
    }

    const body = await request.json() as BodyDTO;
    if (!body.video_id || !body.time || typeof body.time !== "number") {
      return new Response("invalid payload", { 
        status: 400 
      });
    }

    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
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

    return new Response("ok", {
      status: 201
    });
  },
} satisfies ExportedHandler<Env>;

async function hash(str: string) {
  const encode = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", encode);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
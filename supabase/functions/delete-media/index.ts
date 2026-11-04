type Config = { url: string; key: string };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: cors });
}

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => null);
  return typeof body?.message === "string" ? body.message : "The image could not be deleted.";
}

/** Run Storage's DELETE server-side so browser preflight failures cannot interrupt it. */
export async function handleDeleteMedia(
  req: Request,
  config: Config,
  http: typeof fetch = fetch,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Sign in required" });

  const body = await req.json().catch(() => null);
  const id = body?.assetId;
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return reply(400, { error: "Invalid image ID" });

  const headers = {
    apikey: config.key,
    authorization,
    "content-type": "application/json",
  };

  try {
    // The RPC checks editor access and whether published content uses the file.
    const prepared = await http(`${config.url}/rest/v1/rpc/club_prepare_media_delete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ asset_id: id }),
    });
    if (!prepared.ok) return reply(prepared.status, { error: await errorMessage(prepared) });
    const path = await prepared.json();
    if (typeof path !== "string" || !path) return reply(502, { error: "Image path unavailable" });

    const removed = await http(`${config.url}/storage/v1/object/club-media`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ prefixes: [path] }),
    });
    if (!removed.ok) return reply(502, { error: "Storage deletion failed. Please retry." });

    // The database policy permits this only after the Storage object is absent.
    const record = await http(`${config.url}/rest/v1/club_media?id=eq.${id}&select=id`, {
      method: "DELETE",
      headers: { ...headers, prefer: "return=representation" },
    });
    if (!record.ok) return reply(502, { error: "Image record deletion failed. Please retry." });
    const deleted = await record.json().catch(() => null);
    if (!Array.isArray(deleted) || deleted.length !== 1)
      return reply(502, { error: "Storage still has this image. Please retry." });

    return reply(200, { deleted: true });
  } catch {
    return reply(502, { error: "Image deletion could not reach storage. Please retry." });
  }
}

if (typeof Deno !== "undefined") {
  Deno.serve((req) => {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}")?.default ?? "";
    if (!url || !key) return reply(500, { error: "Image deletion is not configured" });
    return handleDeleteMedia(req, { url, key });
  });
}

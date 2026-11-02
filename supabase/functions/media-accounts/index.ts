type Config = { url: string; key: string; secret: string };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const reply = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });

/** Only a verified general administrator can create accounts and select an allowed role. */
export async function handleMediaAccount(req: Request, config: Config, http: typeof fetch = fetch) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Sign in required" });
  try {
    const headers = { apikey: config.key, authorization };
    const userResponse = await http(`${config.url}/auth/v1/user`, { headers });
    if (!userResponse.ok) return reply(401, { error: "Sign in required" });
    const user = await userResponse.json();
    if (typeof user.id !== "string") return reply(401, { error: "Invalid session" });
    const roles = await http(
      `${config.url}/rest/v1/club_admins?select=role&id=eq.${encodeURIComponent(user.id)}`,
      { headers },
    );
    const assigned = roles.ok ? await roles.json() : [];
    if (!Array.isArray(assigned) || assigned[0]?.role !== "super_admin")
      return reply(403, { error: "General administrator required" });
    if (Number(req.headers.get("content-length")) > 4096)
      return reply(413, { error: "Request too large" });
    const text = await req.text();
    if (text.length > 4096) return reply(413, { error: "Request too large" });
    const body = JSON.parse(text);
    const role = body.role === undefined ? "media_editor" : body.role;
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : username;
    if (
      !/^[a-z][a-z0-9_]{2,31}$/.test(username) ||
      !["editor", "media_editor"].includes(role) ||
      name.length < 2 ||
      name.length > 200 ||
      typeof body.password !== "string" ||
      body.password.length < 14 ||
      body.password.length > 128
    )
      return reply(400, {
        error: "Invalid username, name, account type or password length",
      });
    if (!config.secret) return reply(503, { error: "Account provisioning is not configured" });
    const email = `${username}@accounts.itclub.invalid`;
    const privileged = {
      apikey: config.secret,
      authorization: `Bearer ${config.secret}`,
      "content-type": "application/json",
    };
    const created = await http(`${config.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: privileged,
      body: JSON.stringify({
        email,
        password: body.password,
        email_confirm: true,
        app_metadata: {
          provisioned_for: role === "media_editor" ? "media_committee" : "club_administration",
        },
      }),
    });
    if (!created.ok)
      return reply(created.status === 422 ? 409 : 502, {
        error: "Account could not be created; it may already exist",
      });
    const account = await created.json();
    if (typeof account.id !== "string")
      return reply(502, { error: "Account creation was not confirmed" });
    // Only the verified administrator can choose a role; the server rejects elevated or unknown types.
    const granted = await http(`${config.url}/rest/v1/club_admins`, {
      method: "POST",
      headers: privileged,
      body: JSON.stringify({ id: account.id, name, email, role }),
    });
    if (!granted.ok) {
      // A created identity without an assignment has no website administrative rights.
      // Keep it for recovery; never delete an account as an automatic rollback.
      return reply(502, {
        error:
          "Identity created but access was not assigned. Ask the administrator to assign the existing UID.",
        id: account.id,
      });
    }
    return reply(201, { created: true, username, id: account.id });
  } catch {
    return reply(502, {
      error: "Account creation could not be confirmed. Check the account list before retrying.",
    });
  }
}
if (typeof Deno !== "undefined")
  Deno.serve((req) =>
    handleMediaAccount(req, {
      url: Deno.env.get("SUPABASE_URL") || "",
      key:
        JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}")?.default ||
        Deno.env.get("SUPABASE_ANON_KEY") ||
        "",
      secret: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    }),
  );

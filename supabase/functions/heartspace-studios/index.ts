import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function allowedOrigin(origin: string | null) {
  const configured = (Deno.env.get("HEARTSPACE_ALLOWED_ORIGINS") || "https://heartspace.tools,https://www.heartspace.tools")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return origin && configured.includes(origin) ? origin : null;
}

function response(body: Record<string, unknown>, status = 200, origin: string | null = null) {
  const headers = new Headers({ ...corsHeaders, "Content-Type": "application/json" });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(JSON.stringify(body), { status, headers });
}

function slugFrom(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

async function tokenHash(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

Deno.serve(async (request) => {
  const origin = allowedOrigin(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: { ...corsHeaders, ...(origin ? { "Access-Control-Allow-Origin": origin } : {}) } });
  if (!origin) return response({ error: "Origem não autorizada." }, 403);
  if (request.method !== "POST") return response({ error: "Método não permitido." }, 405, origin);

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return response({ error: "Autenticação necessária." }, 401, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response({ error: "Serviço indisponível." }, 503, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return response({ error: "Sessão inválida ou expirada." }, 401, origin);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return response({ error: "Corpo da requisição inválido." }, 400, origin); }

  if (payload.action === "list_studios") {
    const { data, error } = await admin
      .from("studio_members")
      .select("role, created_at, studios(id, name, slug, created_at)")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: true });
    if (error) return response({ error: "Não foi possível carregar seus estúdios." }, 500, origin);
    return response({ studios: data || [] }, 200, origin);
  }

  if (payload.action === "create_studio") {
    const name = typeof payload.name === "string" ? payload.name.trim().replace(/\s+/g, " ") : "";
    const slug = slugFrom(typeof payload.slug === "string" && payload.slug.trim() ? payload.slug : name);
    if (name.length < 2 || name.length > 80 || !/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug)) {
      return response({ error: "Escolha um nome entre 2 e 80 caracteres que gere um endereço válido." }, 400, origin);
    }
    const { data, error } = await admin.rpc("admin_create_studio", { p_actor_id: authData.user.id, p_name: name, p_slug: slug });
    if (error) {
      console.error("create_studio RPC failed", { code: error.code, message: error.message });
      const duplicate = error.code === "23505";
      return response({ error: duplicate ? "Esse endereço de estúdio já está em uso. Escolha outro nome." : "Não foi possível criar o estúdio." }, duplicate ? 409 : 500, origin);
    }
    return response({ studio: data }, 201, origin);
  }

  if (payload.action === "create_invite") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const role = payload.role === "admin" ? "admin" : payload.role === "member" ? "member" : "";
    if (!studioId || !email || !role) return response({ error: "Convite inválido." }, 400, origin);
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin.rpc("admin_create_studio_invite", { p_actor_id: authData.user.id, p_studio_id: studioId, p_email: email, p_role: role, p_token_hash: await tokenHash(token), p_expires_at: expiresAt });
    if (error) return response({ error: error.code === "42501" ? "Você não pode convidar pessoas para este estúdio." : "Não foi possível criar o convite." }, error.code === "42501" ? 403 : 400, origin);
    return response({ invite: data, invite_url: origin + "/invite/?token=" + encodeURIComponent(token) }, 201, origin);
  }

  if (payload.action === "accept_invite") {
    const token = typeof payload.token === "string" ? payload.token : "";
    if (!token || !authData.user.email) return response({ error: "Convite inválido." }, 400, origin);
    const { data, error } = await admin.rpc("admin_accept_studio_invite", { p_actor_id: authData.user.id, p_email: authData.user.email, p_token_hash: await tokenHash(token) });
    if (error) return response({ error: "Este convite não é válido para esta conta ou já expirou." }, 400, origin);
    return response({ studio_id: data }, 200, origin);
  }

  return response({ error: "Ação não reconhecida." }, 400, origin);
});

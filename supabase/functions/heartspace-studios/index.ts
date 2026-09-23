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
      const duplicate = error.code === "23505";
      return response({ error: duplicate ? "Esse endereço de estúdio já está em uso. Escolha outro nome." : "Não foi possível criar o estúdio." }, duplicate ? 409 : 500, origin);
    }
    return response({ studio: data }, 201, origin);
  }

  return response({ error: "Ação não reconhecida." }, 400, origin);
});

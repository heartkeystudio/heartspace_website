import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "https://www.heartspace.tools", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };
const randomState = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  const auth = request.headers.get("Authorization") || "";
  const url = Deno.env.get("SUPABASE_URL") || ""; const anon = Deno.env.get("SUPABASE_ANON_KEY") || ""; const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const clientId = Deno.env.get("GITHUB_CLIENT_ID") || ""; const redirectUri = Deno.env.get("GITHUB_OAUTH_REDIRECT_URI") || "";
  if (!auth.startsWith("Bearer ") || !url || !anon || !service || !clientId || !redirectUri) return new Response(JSON.stringify({ error: "github_not_configured" }), { status: 503, headers });
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: anon } });
  if (!userResponse.ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  const user = await userResponse.json(); const body = await request.json().catch(() => ({})); const studioId = typeof body.studio_id === "string" ? body.studio_id : "";
  const admin = createClient(url, service);
  const { data: membership } = await admin.from("studio_members").select("role").eq("studio_id", studioId).eq("user_id", user.id).maybeSingle();
  if (!studioId || !membership || !["owner", "admin"].includes(membership.role)) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers });
  const state = randomState(); const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await admin.from("github_oauth_states").delete().eq("studio_id", studioId).eq("user_id", user.id);
  const { error } = await admin.from("github_oauth_states").insert({ state, studio_id: studioId, user_id: user.id, expires_at: expiresAt });
  if (error) return new Response(JSON.stringify({ error: "github_migration_required" }), { status: 500, headers });
  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
  authorizationUrl.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state, prompt: "select_account" }).toString();
  return new Response(JSON.stringify({ authorization_url: authorizationUrl.toString() }), { headers });
});

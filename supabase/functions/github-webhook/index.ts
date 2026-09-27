import { createClient } from "npm:@supabase/supabase-js@2";

function hex(bytes: Uint8Array) { return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join(""); }
function equal(left: string, right: string) { if (left.length !== right.length) return false; let result = 0; for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index); return result === 0; }

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET") || ""; const url = Deno.env.get("SUPABASE_URL") || ""; const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const body = await request.text(); const signature = request.headers.get("x-hub-signature-256") || "";
  if (!secret || !url || !service || !signature.startsWith("sha256=")) return new Response("unauthorized", { status: 401 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = `sha256=${hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))))}`;
  if (!equal(signature, expected)) return new Response("unauthorized", { status: 401 });
  let payload: any; try { payload = JSON.parse(body); } catch { return new Response("invalid_json", { status: 400 }); }
  const deliveryId = request.headers.get("x-github-delivery") || crypto.randomUUID(); const event = request.headers.get("x-github-event") || "unknown"; const installationId = Number(payload?.installation?.id || 0) || null; const repositoryId = Number(payload?.repository?.id || 0) || null; const fullName = typeof payload?.repository?.full_name === "string" ? payload.repository.full_name : null;
  const admin = createClient(url, service);
  const { error: deliveryError } = await admin.from("github_webhook_deliveries").insert({ delivery_id: deliveryId, github_event: event, action: typeof payload?.action === "string" ? payload.action : null, github_installation_id: installationId, github_repository_id: repositoryId, repository_full_name: fullName, payload });
  if (deliveryError?.code === "23505") return new Response("ok", { status: 200 });
  if (deliveryError) return new Response("storage_error", { status: 500 });
  if (installationId && repositoryId && fullName) {
    const { data: installations } = await admin.from("studio_github_installations").select("studio_id").eq("github_installation_id", installationId);
    await Promise.all((installations || []).map((installation: { studio_id: string }) => admin.from("project_github_repositories").update({ github_repository_id: repositoryId, default_branch: typeof payload?.repository?.default_branch === "string" ? payload.repository.default_branch : null, last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("studio_id", installation.studio_id).eq("full_name", fullName)));
  }
  return new Response("ok", { status: 202 });
});

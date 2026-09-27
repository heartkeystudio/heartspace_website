import { createClient } from "npm:@supabase/supabase-js@2";

function redirect(result: string) {
  const destination = new URL(Deno.env.get("HEARTSPACE_ACCOUNT_URL") || "https://www.heartspace.tools/account/");
  destination.searchParams.set("github", result);
  return new Response(null, { status: 302, headers: { Location: destination.toString(), "Cache-Control": "no-store" } });
}

Deno.serve(async (request) => {
  const params = new URL(request.url).searchParams; const code = params.get("code") || ""; const state = params.get("state") || "";
  if (!code || !state) return redirect("install-return");
  const url = Deno.env.get("SUPABASE_URL") || ""; const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; const clientId = Deno.env.get("GITHUB_CLIENT_ID") || ""; const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET") || ""; const redirectUri = Deno.env.get("GITHUB_OAUTH_REDIRECT_URI") || ""; const appId = Number(Deno.env.get("GITHUB_APP_ID") || 0);
  if (!url || !service || !clientId || !clientSecret || !redirectUri || !appId) return redirect("error");
  const admin = createClient(url, service); const { data: savedState } = await admin.from("github_oauth_states").select("state, studio_id, user_id, expires_at").eq("state", state).maybeSingle();
  await admin.from("github_oauth_states").delete().eq("state", state);
  if (!savedState || new Date(savedState.expires_at).getTime() < Date.now()) return redirect("error");
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }) });
  const token = tokenResponse.ok ? (await tokenResponse.json()).access_token : "";
  if (!token) return redirect("error");
  const installationsResponse = await fetch("https://api.github.com/user/installations", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" } });
  const payload = installationsResponse.ok ? await installationsResponse.json() : null;
  const installations = Array.isArray(payload?.installations) ? payload.installations.filter((item: any) => Number(item.app_id) === appId) : [];
  if (!installations.length) return redirect("no-installation");
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  await admin.from("github_installation_candidates").delete().eq("studio_id", savedState.studio_id).eq("authorized_user_id", savedState.user_id);
  const rows = installations.map((item: any) => ({ studio_id: savedState.studio_id, github_installation_id: Number(item.id), account_login: String(item.account?.login || "Conta GitHub"), account_type: String(item.account?.type || ""), authorized_user_id: savedState.user_id, expires_at: expiresAt }));
  const { error } = await admin.from("github_installation_candidates").insert(rows);
  if (error) return redirect("error");
  if (rows.length === 1) {
    const candidate = rows[0];
    const { error: installationError } = await admin.from("studio_github_installations").upsert({ studio_id: candidate.studio_id, github_installation_id: candidate.github_installation_id, account_login: candidate.account_login, account_type: candidate.account_type, installed_by: savedState.user_id, installed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "studio_id" });
    return redirect(installationError ? "error" : "linked");
  }
  return redirect("choose-installation");
});

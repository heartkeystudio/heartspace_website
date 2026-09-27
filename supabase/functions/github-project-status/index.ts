import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";
import { createPrivateKey } from "node:crypto";

const headers = { "Access-Control-Allow-Origin": "https://www.heartspace.tools", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };

async function authenticatedUser(request: Request, url: string, anon: string) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: authorization, apikey: anon } });
  return response.ok ? await response.json() : null;
}

async function appJwt(appId: string, privateKey: string) {
  const source = privateKey.replace(/\\n/g, "\n");
  const normalized = createPrivateKey(source).export({ format: "pem", type: "pkcs8" }).toString();
  const key = await importPKCS8(normalized, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({}).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(appId).setIssuedAt(now - 60).setExpirationTime(now + 540).sign(key);
}

async function githubJson(path: string, token: string) {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub respondeu ${response.status}.`);
  return await response.json();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  const url = Deno.env.get("SUPABASE_URL") || ""; const anon = Deno.env.get("SUPABASE_ANON_KEY") || ""; const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const appId = (Deno.env.get("GITHUB_APP_ID") || "").trim(); const privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY") || "";
  if (!url || !anon || !service || !appId || !privateKey) return new Response(JSON.stringify({ error: "github_not_configured" }), { status: 503, headers });
  const user = await authenticatedUser(request, url, anon); if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  const body = await request.json().catch(() => ({})); const studioId = typeof body.studio_id === "string" ? body.studio_id : ""; const projectId = typeof body.project_id === "string" ? body.project_id : "";
  const admin = createClient(url, service);
  const { data: membership } = await admin.from("studio_members").select("role").eq("studio_id", studioId).eq("user_id", user.id).maybeSingle();
  if (!studioId || !projectId || !membership) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers });
  const [{ data: installation }, { data: repository }] = await Promise.all([
    admin.from("studio_github_installations").select("github_installation_id").eq("studio_id", studioId).maybeSingle(),
    admin.from("project_github_repositories").select("full_name").eq("project_id", projectId).eq("studio_id", studioId).maybeSingle(),
  ]);
  if (!installation || !repository) return new Response(JSON.stringify({ error: "github_repository_not_linked" }), { status: 409, headers });
  try {
    const jwt = await appJwt(appId, privateKey);
    const tokenResponse = await fetch(`https://api.github.com/app/installations/${installation.github_installation_id}/access_tokens`, { method: "POST", headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" }, body: JSON.stringify({}) });
    if (!tokenResponse.ok) throw new Error("Não foi possível autorizar a instalação GitHub.");
    const installationToken = (await tokenResponse.json()).token;
    const encoded = repository.full_name.split("/").map(encodeURIComponent).join("/");
    const [repo, pulls, issues, milestones, release] = await Promise.all([
      githubJson(`/repos/${encoded}`, installationToken), githubJson(`/repos/${encoded}/pulls?state=open&per_page=100`, installationToken), githubJson(`/repos/${encoded}/issues?state=open&per_page=100`, installationToken), githubJson(`/repos/${encoded}/milestones?state=open&per_page=100`, installationToken), githubJson(`/repos/${encoded}/releases/latest`, installationToken),
    ]);
    const defaultBranch = String(repo?.default_branch || "");
    const checks = defaultBranch ? await githubJson(`/repos/${encoded}/commits/${encodeURIComponent(defaultBranch)}/check-runs`, installationToken) : null;
    const openIssues = Array.isArray(issues) ? issues.filter((issue: any) => !issue.pull_request).length : 0;
    const checkRuns = Array.isArray(checks?.check_runs) ? checks.check_runs : [];
    const checksState = checkRuns.length ? (checkRuns.some((run: any) => run.conclusion === "failure" || run.conclusion === "cancelled" || run.status !== "completed") ? "attention" : "passing") : "unknown";
    const summary = { repository_full_name: repository.full_name, open_pull_requests: Array.isArray(pulls) ? pulls.length : 0, open_issues: openIssues, open_milestones: Array.isArray(milestones) ? milestones.length : 0, checks_state: checksState, latest_release_name: release?.name || release?.tag_name || null, latest_release_url: release?.html_url || null, fetched_at: new Date().toISOString() };
    await admin.from("project_github_status_snapshots").upsert({ project_id: projectId, studio_id: studioId, github_repository_id: Number(repo?.id || 0) || null, repository_full_name: repository.full_name, default_branch: defaultBranch || null, ...summary, payload: { pulls: Array.isArray(pulls) ? pulls.slice(0, 10).map((pull: any) => ({ number: pull.number, title: pull.title, html_url: pull.html_url, updated_at: pull.updated_at })) : [], issues: Array.isArray(issues) ? issues.filter((issue: any) => !issue.pull_request).slice(0, 10).map((issue: any) => ({ number: issue.number, title: issue.title, html_url: issue.html_url, updated_at: issue.updated_at })) : [] } }, { onConflict: "project_id" });
    return new Response(JSON.stringify({ summary }), { headers });
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Não foi possível consultar o GitHub." }), { status: 502, headers }); }
});

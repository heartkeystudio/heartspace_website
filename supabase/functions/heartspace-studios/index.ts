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

function profileSyncPayload(user: any) {
  const metadata = user?.user_metadata || {};
  const firstName = typeof metadata["first name"] === "string" ? metadata["first name"].trim() : "";
  const lastName = typeof metadata["second name"] === "string" ? metadata["second name"].trim() : "";
  const fullName = [metadata.full_name, metadata.name, metadata.display_name, [firstName, lastName].filter(Boolean).join(" "), metadata.username]
    .find((value) => typeof value === "string" && value.trim());
  const payload: Record<string, unknown> = { id: user.id };
  if (typeof user.email === "string" && user.email.trim()) payload.email = user.email.trim().toLowerCase();
  if (typeof fullName === "string") payload.full_name = fullName.trim();
  const phone = typeof user.phone === "string" && user.phone.trim() ? user.phone : metadata.phone;
  if (typeof phone === "string" && phone.trim()) payload.phone = phone.trim();
  const age = Number(metadata.age);
  if (Number.isInteger(age) && age >= 0 && age <= 130) payload.age = age;
  return payload;
}

async function syncProfileFromAuth(admin: any, user: any) {
  const incoming = profileSyncPayload(user);
  const { data: existing, error: readError } = await admin.from("profiles")
    .select("id, email, full_name, age, phone").eq("id", user.id).maybeSingle();
  if (readError) {
    console.error("profile sync read failed", { code: readError.code, message: readError.message });
    return;
  }
  const payload: Record<string, unknown> = { id: user.id };
  ["email", "full_name", "age", "phone"].forEach((field) => {
    const current = existing?.[field];
    if (current === null || current === undefined || current === "") {
      if (incoming[field] !== undefined) payload[field] = incoming[field];
    }
  });
  const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) console.error("profile sync failed", { code: error.code, message: error.message });
}

async function getMembership(admin: any, studioId: string, userId: string) {
  const { data, error } = await admin.from("studio_members")
    .select("studio_id, user_id, role")
    .eq("studio_id", studioId).eq("user_id", userId).maybeSingle();
  return { membership: data, error };
}

function safePublicationSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.version !== 1 || snapshot.format !== "heartspace-docs-v1" || !Array.isArray(snapshot.blocks) || snapshot.blocks.length > 500) return null;
  const allowedTypes = new Set([0, 1, 2, 3, 4, 6, 8, 13]);
  const blocks: Array<Record<string, unknown>> = [];
  for (const raw of snapshot.blocks) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const block = raw as Record<string, unknown>;
    const type = Number(block.type);
    const text = typeof block.text === "string" ? block.text.trim() : "";
    if (!Number.isInteger(type) || !allowedTypes.has(type) || text.length > 12000) return null;
    // O contrato atual não transporta HTML, estilos, caminhos ou URLs locais.
    if (/\b(?:res|user|file):\/\//i.test(text) || /<\s*script\b|on\w+\s*=/i.test(text)) return null;
    blocks.push({ type, text });
  }
  const clean = { version: 1, format: "heartspace-docs-v1", blocks };
  return JSON.stringify(clean).length <= 500000 ? clean : null;
}

async function canManageProjectPublications(admin: any, studioId: string, projectId: string, userId: string) {
  const [{ data: project, error: projectError }, { membership, error: membershipError }] = await Promise.all([
    admin.from("projects").select("id, studio_id, owner_id, role_permissions").eq("id", projectId).eq("studio_id", studioId).maybeSingle(),
    getMembership(admin, studioId, userId),
  ]);
  if (projectError || !project || membershipError || !membership) return { allowed: false, project: null };
  if (project.owner_id === userId || ["owner", "admin"].includes(membership.role)) return { allowed: true, project };
  const { data: member } = await admin.from("project_members").select("role, roles").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
  const roles = Array.isArray(member?.roles) && member.roles.length ? member.roles : member?.role ? [member.role] : [];
  const permissions = project.role_permissions && typeof project.role_permissions === "object" ? project.role_permissions as Record<string, any> : {};
  const allowed = roles.some((role: unknown) => permissions[String(role)]?.manage_publications === true || permissions[String(role)]?.manage_workspace === true);
  return { allowed, project };
}

async function memberDetails(admin: any, rows: Array<any>) {
  return Promise.all(rows.map(async (member) => {
    const userId = typeof member.user_id === "string" ? member.user_id : "";
    const { data } = userId ? await admin.auth.admin.getUserById(userId) : { data: { user: null } };
    return {
      ...member,
      email: data.user?.email || null,
      display_name: typeof data.user?.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : null,
    };
  }));
}

const productionTemplates: Record<string, { label: string; permissions: Record<string, Record<string, boolean>>; colors: Record<string, string> }> = {
  game_development: {
    label: "Desenvolvimento de jogos",
    permissions: {
      game_designer: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true, create_sprints: true },
      artist: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      programmer: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      audio: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      narrative: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      qa: { can_view_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      producer: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true, create_sprints: true, delete_sprints: true, manage_wiki_visibility: true },
      marketing: { can_view_wiki: true, can_comment_wiki: true, view_all_tasks: true },
    },
    colors: { game_designer: "#a855f7", artist: "#ec4899", programmer: "#22c55e", audio: "#f59e0b", narrative: "#38bdf8", qa: "#f97316", producer: "#e879f9", marketing: "#60a5fa" },
  },
  creative_studio: {
    label: "Estúdio criativo",
    permissions: {
      direction: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true, create_sprints: true, manage_wiki_visibility: true },
      design: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      illustration: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      video: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      writing: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      production: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true, create_sprints: true, delete_sprints: true },
    },
    colors: { direction: "#a855f7", design: "#ec4899", illustration: "#f97316", video: "#38bdf8", writing: "#22c55e", production: "#e879f9" },
  },
  marketing: {
    label: "Marketing",
    permissions: {
      strategy: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true, create_sprints: true },
      content: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      design: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      paid_media: { can_view_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      social: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      analytics: { can_view_wiki: true, can_comment_wiki: true, view_all_tasks: true },
    },
    colors: { strategy: "#a855f7", content: "#38bdf8", design: "#ec4899", paid_media: "#f59e0b", social: "#22c55e", analytics: "#f97316" },
  },
  accounting: {
    label: "Contabilidade",
    permissions: {
      management: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true, create_sprints: true },
      accounting: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      tax: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      payroll: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      finance: { can_view_wiki: true, can_edit_wiki: true, can_comment_wiki: true, view_all_tasks: true },
      service: { can_view_wiki: true, can_comment_wiki: true, view_all_tasks: true },
    },
    colors: { management: "#a855f7", accounting: "#22c55e", tax: "#f59e0b", payroll: "#38bdf8", finance: "#ec4899", service: "#94a3b8" },
  },
  blank: { label: "Em branco", permissions: {}, colors: {} },
};

function templateKey(value: unknown) {
  return typeof value === "string" && productionTemplates[value] ? value : "blank";
}

function cleanRoleKeys(value: unknown, permissions: Record<string, Record<string, boolean>>) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((role): role is string => typeof role === "string" && Object.prototype.hasOwnProperty.call(permissions, role))));
}

const allowedProjectPermissions = new Set([
  "manage_workspace", "manage_roles", "manage_billing", "delete_sprints", "create_sprints", "view_all_tasks",
  "manage_wiki_visibility", "can_edit_wiki", "can_comment_wiki", "can_view_wiki",
  "docs_view", "docs_edit", "docs_comment", "manage_publications", "tasks_view", "tasks_edit", "canvas_view", "canvas_edit", "beats_view", "beats_edit",
  "states_view", "states_edit", "dialogues_view", "dialogues_edit", "polygons_view", "polygons_edit", "designs_view", "designs_edit",
]);

function defaultRoleLabel(key: string) {
  return key.split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function labelsForTemplate(template: { permissions: Record<string, Record<string, boolean>> }) {
  return Object.fromEntries(Object.keys(template.permissions).map((key) => [key, defaultRoleLabel(key)]));
}

function base64Bytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64Value(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

async function cloudTokenKey() {
  const value = Deno.env.get("HEARTSPACE_CLOUD_TOKEN_KEY") || "";
  const bytes = value ? base64Bytes(value) : new Uint8Array();
  if (bytes.byteLength !== 32) throw new Error("A chave HEARTSPACE_CLOUD_TOKEN_KEY deve ter 32 bytes em Base64.");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptCloudToken(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await cloudTokenKey();
  const payload = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  return { token_ciphertext: base64Value(new Uint8Array(encrypted)), token_iv: base64Value(iv) };
}

async function decryptCloudToken(connection: any) {
  const key = await cloudTokenKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64Bytes(connection.token_iv) }, key, base64Bytes(connection.token_ciphertext));
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function googleAccessToken(connection: any) {
  const saved = await decryptCloudToken(connection);
  if (!saved.refresh_token) throw new Error("A conexão do Google Drive não possui token de renovação. Conecte novamente.");
  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") || "";
  const refresh = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: saved.refresh_token }) });
  const data = await refresh.json().catch(() => ({}));
  if (!refresh.ok || !data.access_token) throw new Error("Não foi possível renovar a conexão do Google Drive.");
  return String(data.access_token);
}

async function createGoogleFolder(accessToken: string, name: string, parentId?: string | null) {
  const body: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) body.parents = [parentId];
  const result = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", { method: "POST", headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await result.json().catch(() => ({}));
  if (!result.ok || !data.id) throw new Error("O Google Drive não permitiu criar a pasta.");
  return { id: String(data.id), name: String(data.name || name) };
}

function cloudCallbackPage(message: string, success: boolean) {
  const accountUrl = (Deno.env.get("HEARTSPACE_ACCOUNT_URL") || "https://www.heartspace.tools/account/").replace(/\/$/, "");
  const target = accountUrl + "?cloud=" + (success ? "connected" : "error");
  const safeMessage = message.replace(/[<&>]/g, "");
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="refresh" content="3;url=${target}"><title>HeartSpace</title><body style="font-family:system-ui;background:#141416;color:#f5f2f6;padding:48px"><h1>${success ? "Google Drive conectado" : "Não foi possível conectar"}</h1><p>${safeMessage}</p><p><a style="color:#db91f5" href="${target}">Voltar ao HeartSpace</a></p></body></html>`, { status: success ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (request) => {
  const callbackUrl = new URL(request.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response({ error: "Serviço indisponível." }, 503);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  if (request.method === "GET" && callbackUrl.searchParams.get("cloud_callback") === "google") {
    const state = callbackUrl.searchParams.get("state") || "";
    const code = callbackUrl.searchParams.get("code") || "";
    const denied = callbackUrl.searchParams.get("error");
    if (!state || !code || denied) return cloudCallbackPage("A autorização foi cancelada ou expirou. Tente novamente no painel.", false);
    const { data: oauthState } = await admin.from("cloud_oauth_states").select("state, studio_id, created_by, expires_at, consumed_at").eq("state", state).eq("provider", "google_drive").maybeSingle();
    if (!oauthState || oauthState.consumed_at || new Date(oauthState.expires_at).getTime() < Date.now()) return cloudCallbackPage("Este link de autorização expirou. Inicie a conexão novamente.", false);
    const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") || "";
    const redirectUri = (Deno.env.get("GOOGLE_DRIVE_REDIRECT_URI") || callbackUrl.origin + callbackUrl.pathname + "?cloud_callback=google");
    if (!clientId || !clientSecret) return cloudCallbackPage("A conexão Google Drive ainda não foi configurada no servidor.", false);
    try {
      const exchange = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
      const tokenData = await exchange.json().catch(() => ({}));
      if (!exchange.ok || !tokenData.refresh_token) throw new Error("O Google não retornou autorização offline. Tente conectar novamente.");
      const account = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: "Bearer " + tokenData.access_token } }).then((result) => result.ok ? result.json() : {});
      const { data: studio } = await admin.from("studios").select("name").eq("id", oauthState.studio_id).maybeSingle();
      const root = await createGoogleFolder(String(tokenData.access_token), "HeartSpace — " + String(studio?.name || "Estúdio"));
      const encrypted = await encryptCloudToken({ refresh_token: tokenData.refresh_token });
      const { error } = await admin.from("studio_cloud_connections").upsert({ studio_id: oauthState.studio_id, provider: "google_drive", provider_account_id: typeof account.id === "string" ? account.id : null, provider_account_email: typeof account.email === "string" ? account.email : null, root_folder_id: root.id, root_folder_name: root.name, ...encrypted, scopes: typeof tokenData.scope === "string" ? tokenData.scope.split(" ") : [], connected_by: oauthState.created_by, connected_at: new Date().toISOString(), revoked_at: null }, { onConflict: "studio_id,provider" });
      if (error) throw error;
      await admin.from("cloud_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("state", state);
      await admin.from("studio_audit_log").insert({ studio_id: oauthState.studio_id, actor_id: oauthState.created_by, action: "cloud.google_drive_connected", target_type: "cloud_connection", target_id: root.id });
      return cloudCallbackPage("A conta compartilhada e a pasta raiz foram configuradas. Você já pode preparar os projetos.", true);
    } catch (error) { console.error("google callback failed", error); return cloudCallbackPage(error instanceof Error ? error.message : "Não foi possível concluir a conexão.", false); }
  }
  const requestOrigin = request.headers.get("origin");
  const origin = allowedOrigin(requestOrigin);
  const nativeHubRequest = !requestOrigin && (request.headers.get("authorization") || "").startsWith("Bearer ");
  if (request.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: { ...corsHeaders, ...(origin ? { "Access-Control-Allow-Origin": origin } : {}) } });
  if (!origin && !nativeHubRequest) return response({ error: "Origem não autorizada." }, 403);
  if (request.method !== "POST") return response({ error: "Método não permitido." }, 405, origin);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return response({ error: "Corpo da requisição inválido." }, 400, origin); }

  if (payload.action === "get_publication") {
    const publicationId = typeof payload.publication_id === "string" ? payload.publication_id : "";
    if (!publicationId) return response({ error: "Publicação inválida." }, 400, origin);
    const { data: publication, error } = await admin.from("project_publications")
      .select("id, studio_id, project_id, title, slug, summary, source_url, visibility, status, published_at, updated_at, snapshot_json, snapshot_version")
      .eq("id", publicationId).eq("status", "published").maybeSingle();
    if (error || !publication) return response({ error: "Publicação não encontrada." }, 404, origin);
    const [{ data: project }, { data: studio }] = await Promise.all([
      admin.from("projects").select("name, cover_image, banner_image").eq("id", publication.project_id).maybeSingle(),
      admin.from("studios").select("name, logo_url").eq("id", publication.studio_id).maybeSingle(),
    ]);
    const { studio_id: _studioId, project_id: _projectId, ...publicPublication } = publication;
    return response({ publication: publicPublication, project: project || {}, studio: studio || {} }, 200, origin);
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return response({ error: "Autenticação necessária." }, 401, origin);
  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return response({ error: "Sessão inválida ou expirada." }, 401, origin);
  await syncProfileFromAuth(admin, authData.user);

  if (payload.action === "get_profile") {
    const { data, error } = await admin.from("profiles")
      .select("id, email, full_name, nickname, age, profession, phone, avatar_url, profile_completed_at")
      .eq("id", authData.user.id).maybeSingle();
    if (error || !data) return response({ error: "Não foi possível carregar sua ficha de perfil." }, 500, origin);
    return response({ profile: data }, 200, origin);
  }

  if (payload.action === "update_profile") {
    const fullName = typeof payload.full_name === "string" ? payload.full_name.trim().replace(/\s+/g, " ") : "";
    const nickname = typeof payload.nickname === "string" ? payload.nickname.trim().replace(/\s+/g, " ") : "";
    const age = Number(payload.age);
    const profession = typeof payload.profession === "string" ? payload.profession.trim().replace(/\s+/g, " ") : "";
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const avatarUrl = typeof payload.avatar_url === "string" ? payload.avatar_url.trim() : "";
    if (fullName.length < 2 || fullName.length > 80 || nickname.length < 2 || nickname.length > 40 || !Number.isInteger(age) || age < 1 || age > 130 || profession.length < 2 || profession.length > 120 || phone.length > 40 || avatarUrl.length > 2048 || (avatarUrl && !/^https:\/\//i.test(avatarUrl))) {
      return response({ error: "Confira nome, apelido, idade e profissão antes de continuar." }, 400, origin);
    }
    const { data, error } = await admin.from("profiles").upsert({
      id: authData.user.id,
      full_name: fullName,
      nickname,
      age,
      profession,
      phone: phone || null,
      avatar_url: avatarUrl || null,
      profile_completed_at: new Date().toISOString(),
    }, { onConflict: "id" }).select("id, email, full_name, nickname, age, profession, phone, avatar_url, profile_completed_at").single();
    if (error) {
      console.error("update_profile failed", { code: error.code, message: error.message, details: error.details });
      const missingSchema = error.code === "42703" || /column .* does not exist/i.test(error.message || "");
      return response({ error: missingSchema ? "A ficha ainda precisa da migration de perfil. Execute SUPABASE_PROFILE_REPAIR.sql no Supabase." : "Não foi possível salvar sua ficha agora." }, 500, origin);
    }
    const metadata = authData.user.user_metadata || {};
    await admin.auth.admin.updateUserById(authData.user.id, { user_metadata: { ...metadata, full_name: fullName } });
    return response({ profile: data }, 200, origin);
  }

  if (payload.action === "upload_profile_avatar") {
    const imageBase64 = typeof payload.image_base64 === "string" ? payload.image_base64 : "";
    const match = imageBase64.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match || imageBase64.length > 230000) return response({ error: "Envie uma imagem PNG, JPEG ou WebP válida e pequena." }, 400, origin);
    let bytes: Uint8Array;
    try { const binary = atob(match[2]); bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
    catch { return response({ error: "A imagem não pôde ser lida." }, 400, origin); }
    if (!bytes.length || bytes.length > 160 * 1024) return response({ error: "A foto comprimida deve ter no máximo 160 KB." }, 400, origin);
    const extension = match[1] === "image/png" ? "png" : match[1] === "image/jpeg" ? "jpg" : "webp";
    const path = `${authData.user.id}/avatar.${extension}`;
    const { error: uploadError } = await admin.storage.from("profile-avatars").upload(path, bytes, { contentType: match[1], upsert: true, cacheControl: "31536000" });
    if (uploadError) return response({ error: "Não foi possível enviar a foto agora." }, 500, origin);
    const { data } = admin.storage.from("profile-avatars").getPublicUrl(path);
    return response({ avatar_url: `${data.publicUrl}?v=${Date.now()}` }, 201, origin);
  }

  if (payload.action === "list_studios") {
    const { data: memberships, error: membershipError } = await admin
      .from("studio_members")
      // A tabela de membros já existia no Hub e nem toda instalação legada
      // possui uma coluna `created_at`.
      .select("studio_id, role")
      .eq("user_id", authData.user.id);
    if (membershipError) {
      console.error("list_studios memberships failed", {
        code: membershipError.code,
        message: membershipError.message,
        details: membershipError.details,
      });
      return response({ error: "Não foi possível carregar seus estúdios." }, 500, origin);
    }
    const studioIds = (memberships || []).map((membership) => membership.studio_id);
    if (!studioIds.length) return response({ studios: [] }, 200, origin);
    const { data: studios, error: studiosError } = await admin
      // A listagem precisa continuar compatível com o banco legado do Hub, onde
      // `slug` não era uma coluna obrigatória.
      .from("studios").select("id, name, created_at").in("id", studioIds);
    if (studiosError) {
      console.error("list_studios studios failed", {
        code: studiosError.code,
        message: studiosError.message,
        details: studiosError.details,
      });
      return response({ error: "Não foi possível carregar seus estúdios." }, 500, origin);
    }
    const byId = new Map((studios || []).map((studio) => [studio.id, studio]));
    return response({ studios: (memberships || []).map((membership) => ({ ...membership, studios: byId.get(membership.studio_id) })).filter((membership) => membership.studios) }, 200, origin);
  }

  if (payload.action === "create_studio") {
    const name = typeof payload.name === "string" ? payload.name.trim().replace(/\s+/g, " ") : "";
    const slug = slugFrom(typeof payload.slug === "string" && payload.slug.trim() ? payload.slug : name);
    const roleTemplateKey = templateKey(payload.role_template_key);
    if (name.length < 2 || name.length > 80 || !/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug)) {
      return response({ error: "Escolha um nome entre 2 e 80 caracteres que gere um endereço válido." }, 400, origin);
    }
    const { data, error } = await admin.rpc("admin_create_studio", { p_actor_id: authData.user.id, p_name: name, p_slug: slug });
    if (error) {
      console.error("create_studio RPC failed", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      const duplicate = error.code === "23505";
      return response({ error: duplicate ? "Esse endereço de estúdio já está em uso. Escolha outro nome." : "Não foi possível criar o estúdio." }, duplicate ? 409 : 500, origin);
    }
    const studioId = data?.id || data;
    if (typeof studioId === "string") {
      const { error: templateError } = await admin.from("studios").update({ role_template_key: roleTemplateKey }).eq("id", studioId);
      if (templateError) {
        console.error("create_studio template failed", { code: templateError.code, message: templateError.message });
        return response({ error: "O estúdio foi criado, mas o modelo de papéis não pôde ser aplicado. Execute a migration de papéis e tente novamente." }, 500, origin);
      }
    }
    return response({ studio: data, role_template_key: roleTemplateKey }, 201, origin);
  }

  if (payload.action === "upload_studio_icon") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const imageBase64 = typeof payload.image_base64 === "string" ? payload.image_base64 : "";
    const match = imageBase64.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!studioId || !match || imageBase64.length > 140000) return response({ error: "Envie uma imagem PNG, JPEG ou WebP válida e pequena." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Você não pode alterar o ícone deste estúdio." }, 403, origin);
    let bytes: Uint8Array;
    try {
      const binary = atob(match[2]);
      bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch { return response({ error: "A imagem não pôde ser lida." }, 400, origin); }
    if (!bytes.length || bytes.length > 96 * 1024) return response({ error: "O ícone comprimido deve ter no máximo 96 KB." }, 400, origin);
    const extension = match[1] === "image/png" ? "png" : match[1] === "image/jpeg" ? "jpg" : "webp";
    const path = `${studioId}/icon.${extension}`;
    const { error: uploadError } = await admin.storage.from("studio-icons").upload(path, bytes, { contentType: match[1], upsert: true, cacheControl: "31536000" });
    if (uploadError) {
      console.error("upload_studio_icon failed", { message: uploadError.message });
      return response({ error: "Não foi possível enviar o ícone agora." }, 500, origin);
    }
    const { data } = admin.storage.from("studio-icons").getPublicUrl(path);
    return response({ logo_url: `${data.publicUrl}?v=${Date.now()}` }, 201, origin);
  }

  if (payload.action === "get_cloud_sync") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    if (!studioId) return response({ error: "Selecione um estúdio." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership) return response({ error: "Você não possui acesso a este estúdio." }, 403, origin);
    const [{ data: connection, error: connectionError }, { data: projects, error: projectsError }] = await Promise.all([
      admin.from("studio_cloud_connections").select("id, provider, provider_account_email, root_folder_id, root_folder_name, connected_at, last_validated_at").eq("studio_id", studioId).eq("provider", "google_drive").is("revoked_at", null).maybeSingle(),
      admin.from("projects").select("id, name, status").eq("studio_id", studioId).order("created_at", { ascending: true }),
    ]);
    if (connectionError || projectsError) return response({ error: "A sincronização em nuvem ainda precisa da migration SUPABASE_CLOUD_SYNC.sql." }, 500, origin);
    const projectIds = (projects || []).map((project: any) => project.id);
    const { data: syncs, error: syncsError } = projectIds.length ? await admin.from("project_cloud_sync_configs").select("project_id, folder_id, folder_name, sync_enabled, last_sync_at, last_sync_status, updated_at").in("project_id", projectIds) : { data: [], error: null };
    if (syncsError) return response({ error: "Não foi possível carregar as pastas dos projetos." }, 500, origin);
    return response({ connection: connection || null, projects: projects || [], project_syncs: syncs || [], can_manage: ["owner", "admin"].includes(membership.role) }, 200, origin);
  }

  if (payload.action === "start_google_drive_connection") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (!studioId || membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Apenas Owner ou Admin pode conectar o Drive do estúdio." }, 403, origin);
    const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") || "";
    if (!clientId || !clientSecret) return response({ error: "A conexão Google Drive ainda não foi configurada no servidor." }, 503, origin);
    const state = randomToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await admin.from("cloud_oauth_states").delete().eq("studio_id", studioId).eq("provider", "google_drive");
    const { error } = await admin.from("cloud_oauth_states").insert({ state, studio_id: studioId, provider: "google_drive", created_by: authData.user.id, expires_at: expiresAt });
    if (error) return response({ error: "A conexão em nuvem ainda precisa da migration SUPABASE_CLOUD_SYNC.sql." }, 500, origin);
    const functionUrl = new URL(request.url);
    const redirectUri = Deno.env.get("GOOGLE_DRIVE_REDIRECT_URI") || functionUrl.origin + functionUrl.pathname + "?cloud_callback=google";
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, scope: "openid email https://www.googleapis.com/auth/drive.file" }).toString();
    return response({ authorization_url: authorizationUrl.toString() }, 200, origin);
  }

  if (payload.action === "configure_project_cloud_sync") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    const syncEnabled = payload.sync_enabled !== false;
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (!studioId || !projectId || membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Apenas Owner ou Admin pode configurar a sincronização." }, 403, origin);
    const [{ data: project }, { data: connection, error: connectionError }] = await Promise.all([
      admin.from("projects").select("id, name").eq("id", projectId).eq("studio_id", studioId).maybeSingle(),
      admin.from("studio_cloud_connections").select("id, root_folder_id, token_ciphertext, token_iv").eq("studio_id", studioId).eq("provider", "google_drive").is("revoked_at", null).maybeSingle(),
    ]);
    if (connectionError || !connection) return response({ error: "Conecte o Google Drive compartilhado antes de preparar um projeto." }, 409, origin);
    if (!project) return response({ error: "Projeto não encontrado." }, 404, origin);
    const { data: existing } = await admin.from("project_cloud_sync_configs").select("project_id, folder_id, folder_name").eq("project_id", projectId).maybeSingle();
    let folder = existing;
    if (!folder) {
      const accessToken = await googleAccessToken(connection);
      folder = await createGoogleFolder(accessToken, project.name, connection.root_folder_id);
    }
    const { data: sync, error } = await admin.from("project_cloud_sync_configs").upsert({ project_id: projectId, connection_id: connection.id, folder_id: folder.folder_id || folder.id, folder_name: folder.folder_name || folder.name, sync_enabled: syncEnabled, updated_by: authData.user.id, updated_at: new Date().toISOString() }, { onConflict: "project_id" }).select("project_id, folder_id, folder_name, sync_enabled, updated_at").single();
    if (error) return response({ error: "Não foi possível salvar a pasta de sincronização." }, 500, origin);
    await admin.from("studio_audit_log").insert({ studio_id: studioId, actor_id: authData.user.id, action: existing ? "cloud.project_sync_updated" : "cloud.project_folder_created", target_type: "project", target_id: projectId });
    return response({ sync }, existing ? 200 : 201, origin);
  }

  if (payload.action === "disconnect_google_drive") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (!studioId || membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Apenas Owner ou Admin pode desconectar o Drive do estúdio." }, 403, origin);
    const { error } = await admin.from("studio_cloud_connections").update({ revoked_at: new Date().toISOString() }).eq("studio_id", studioId).eq("provider", "google_drive").is("revoked_at", null);
    if (error) return response({ error: "Não foi possível desconectar o Google Drive." }, 500, origin);
    await admin.from("studio_audit_log").insert({ studio_id: studioId, actor_id: authData.user.id, action: "cloud.google_drive_disconnected", target_type: "cloud_connection", target_id: studioId });
    return response({ ok: true }, 200, origin);
  }

  if (payload.action === "get_hub_project_cloud_sync" || payload.action === "issue_hub_cloud_access") {
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    if (!projectId) return response({ error: "Projeto inválido." }, 400, origin);
    const { data: project } = await admin.from("projects").select("id, studio_id, name, status").eq("id", projectId).maybeSingle();
    if (!project) return response({ error: "Projeto não encontrado." }, 404, origin);
    const { membership, error: membershipError } = await getMembership(admin, project.studio_id, authData.user.id);
    if (membershipError || !membership) return response({ error: "Você não possui acesso a este projeto." }, 403, origin);
    const { data: sync } = await admin.from("project_cloud_sync_configs").select("project_id, folder_id, folder_name, sync_enabled, last_sync_at, last_sync_status, connection_id").eq("project_id", projectId).maybeSingle();
    if (!sync || !sync.sync_enabled || project.status === "archived") return response({ sync: null }, 200, origin);
    const { data: connection } = await admin.from("studio_cloud_connections").select(payload.action === "issue_hub_cloud_access" ? "id, provider, token_ciphertext, token_iv" : "id, provider").eq("id", sync.connection_id).is("revoked_at", null).maybeSingle();
    if (!connection) return response({ sync: null }, 200, origin);
    if (payload.action === "issue_hub_cloud_access") {
      if (connection.provider !== "google_drive") return response({ error: "Este provedor ainda não é suportado pelo Hub." }, 409, origin);
      try {
        const accessToken = await googleAccessToken(connection);
        return response({ provider: "google_drive", access_token: accessToken, expires_in: 3600, folder_id: sync.folder_id }, 200, origin);
      } catch (error) { return response({ error: error instanceof Error ? error.message : "Não foi possível autorizar a sincronização." }, 502, origin); }
    }
    return response({ sync: { provider: connection.provider, folder_id: sync.folder_id, folder_name: sync.folder_name, last_sync_at: sync.last_sync_at, last_sync_status: sync.last_sync_status } }, 200, origin);
  }

  if (payload.action === "list_publications") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    if (!studioId || !projectId) return response({ error: "Selecione um projeto." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership) return response({ error: "Você não possui acesso a este projeto." }, 403, origin);
    const { data, error } = await admin.from("project_publications")
      .select("id, project_id, title, slug, summary, source_url, visibility, status, published_at, created_at, updated_at")
      .eq("studio_id", studioId).eq("project_id", projectId).order("updated_at", { ascending: false });
    if (error) return response({ error: "Não foi possível carregar as publicações." }, 500, origin);
    return response({ publications: data || [] }, 200, origin);
  }

  if (payload.action === "save_publication") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    const publicationId = typeof payload.publication_id === "string" ? payload.publication_id : "";
    const title = typeof payload.title === "string" ? payload.title.trim().replace(/\s+/g, " ") : "";
    const slug = slugFrom(typeof payload.slug === "string" ? payload.slug : title);
    const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
    const sourceUrl = typeof payload.source_url === "string" ? payload.source_url.trim() : "";
    const visibility = payload.visibility === "unlisted" ? "unlisted" : payload.visibility === "public" ? "public" : "";
    const status = typeof payload.status === "string" && ["draft", "published", "withdrawn"].includes(payload.status) ? payload.status : "";
    if (!studioId || !projectId || !title || !slug || !visibility || !status || title.length > 160 || summary.length > 500 || sourceUrl.length > 2048 || (sourceUrl && !/^https:\/\//i.test(sourceUrl))) return response({ error: "Dados de publicação inválidos." }, 400, origin);
    const access = await canManageProjectPublications(admin, studioId, projectId, authData.user.id);
    if (!access.allowed) return response({ error: "Você não pode administrar publicações deste projeto." }, 403, origin);
    const source = payload.source && typeof payload.source === "object" && !Array.isArray(payload.source) ? payload.source as Record<string, unknown> : null;
    const snapshot = safePublicationSnapshot(payload.snapshot);
    if ((source || payload.snapshot) && (!source || !snapshot || status !== "published")) return response({ error: "Snapshot público ou origem da revisão inválidos." }, 400, origin);
    let sourceRevision: any = null;
    if (source) {
      const documentId = typeof source.document_id === "string" ? source.document_id : "";
      const revisionId = typeof source.revision_id === "string" ? source.revision_id : "";
      if (!documentId || !revisionId || source.format !== "heartspace-docs-v1") return response({ error: "Origem do Docs inválida." }, 400, origin);
      const [{ data: revision }, { data: document }] = await Promise.all([
        admin.from("doc_revisions").select("id, doc_id, revision_number, approved_by, approved_at").eq("id", revisionId).eq("doc_id", documentId).maybeSingle(),
        admin.from("docs").select("id, project_id").eq("id", documentId).maybeSingle(),
      ]);
      if (!revision || !document || document.project_id !== projectId || !revision.approved_at || Number(source.revision_number) !== revision.revision_number) return response({ error: "A revisão indicada não está aprovada para este projeto." }, 409, origin);
      sourceRevision = revision;
    }
    const publication: Record<string, unknown> = { studio_id: studioId, project_id: projectId, title, slug, summary: summary || null, source_url: sourceUrl || null, visibility, status, published_at: status === "published" ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    if (source && snapshot && sourceRevision) Object.assign(publication, { source_document_id: sourceRevision.doc_id, source_revision_id: sourceRevision.id, source_revision_number: sourceRevision.revision_number, snapshot_json: snapshot, snapshot_version: 1, approved_by: sourceRevision.approved_by, approved_at: sourceRevision.approved_at });
    const query = publicationId
      ? admin.from("project_publications").update(publication).eq("id", publicationId).eq("studio_id", studioId).eq("project_id", projectId)
      : admin.from("project_publications").insert(publication);
    const { data, error } = await query.select("id, title, slug, summary, source_url, visibility, status, published_at, created_at, updated_at, snapshot_version").single();
    if (error) return response({ error: error.code === "23505" ? "Já existe uma publicação com este endereço neste projeto." : "Não foi possível salvar a publicação." }, 500, origin);
    if (source && snapshot && sourceRevision) {
      const { data: lastRevision } = await admin.from("project_publication_revisions").select("revision_number").eq("publication_id", data.id).order("revision_number", { ascending: false }).limit(1).maybeSingle();
      const { data: publishedRevision, error: revisionError } = await admin.from("project_publication_revisions").insert({ publication_id: data.id, revision_number: Number(lastRevision?.revision_number || 0) + 1, source_document_id: sourceRevision.doc_id, source_revision_id: sourceRevision.id, source_revision_number: sourceRevision.revision_number, snapshot_json: snapshot, snapshot_version: 1, approved_by: sourceRevision.approved_by, approved_at: sourceRevision.approved_at, published_by: authData.user.id }).select("id").single();
      if (revisionError || !publishedRevision) return response({ error: "A publicação foi salva, mas o snapshot imutável não pôde ser registrado." }, 500, origin);
      await admin.from("project_publications").update({ current_revision_id: publishedRevision.id }).eq("id", data.id);
    }
    await admin.from("studio_audit_log").insert({ studio_id: studioId, actor_id: authData.user.id, action: `publication.${status}`, target_type: "publication", target_id: data.id });
    return response({ publication: data }, publicationId ? 200 : 201, origin);
  }

  if (payload.action === "list_project_apps") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    if (!studioId || !projectId) return response({ error: "Selecione um projeto." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership) return response({ error: "Você não possui acesso a este projeto." }, 403, origin);
    const { data, error } = await admin.from("project_apps").select("app_key, enabled, updated_at").eq("project_id", projectId);
    if (error) return response({ error: "Não foi possível carregar os apps." }, 500, origin);
    return response({ apps: data || [] }, 200, origin);
  }

  if (payload.action === "set_project_app") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    const appKey = typeof payload.app_key === "string" ? payload.app_key : "";
    const enabled = typeof payload.enabled === "boolean" ? payload.enabled : null;
    const allowedApps = ["docs", "tasks", "canvas", "beats", "states", "dialogues", "polygons", "designs"];
    if (!studioId || !projectId || !allowedApps.includes(appKey) || enabled === null) return response({ error: "Configuração de app inválida." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Você não pode configurar apps neste projeto." }, 403, origin);
    const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("studio_id", studioId).maybeSingle();
    if (!project) return response({ error: "Projeto não encontrado." }, 404, origin);
    const { error } = await admin.from("project_apps").upsert({ project_id: projectId, app_key: appKey, enabled, updated_at: new Date().toISOString() }, { onConflict: "project_id,app_key" });
    if (error) return response({ error: "Não foi possível salvar o app." }, 500, origin);
    await admin.from("studio_audit_log").insert({ studio_id: studioId, actor_id: authData.user.id, action: enabled ? "project.app_enabled" : "project.app_disabled", target_type: "project", target_id: projectId });
    return response({ app_key: appKey, enabled }, 200, origin);
  }

  if (payload.action === "list_studio_audit") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    if (!studioId) return response({ error: "Selecione um estúdio." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership) return response({ error: "Você não possui acesso a este estúdio." }, 403, origin);
    const { data, error } = await admin.from("studio_audit_log")
      .select("id, action, target_type, target_id, created_at").eq("studio_id", studioId).order("created_at", { ascending: false }).limit(100);
    if (error) return response({ error: "Não foi possível carregar o histórico de auditoria." }, 500, origin);
    return response({ events: data || [] }, 200, origin);
  }

  if (payload.action === "get_account_usage") {
    const { data: memberships, error: membershipError } = await admin.from("studio_members").select("studio_id").eq("user_id", authData.user.id);
    if (membershipError) return response({ error: "Não foi possível calcular o uso da conta." }, 500, origin);
    const studioIds = Array.from(new Set((memberships || []).map((row: any) => row.studio_id).filter(Boolean)));
    if (!studioIds.length) return response({ usage: { studios: 0, projects: 0, members: 0, publications: 0 } }, 200, origin);
    const [{ count: projects }, { count: members }, { count: publications }] = await Promise.all([
      admin.from("projects").select("id", { count: "exact", head: true }).in("studio_id", studioIds),
      admin.from("studio_members").select("user_id", { count: "exact", head: true }).in("studio_id", studioIds),
      admin.from("project_publications").select("id", { count: "exact", head: true }).in("studio_id", studioIds),
    ]);
    return response({ usage: { studios: studioIds.length, projects: projects || 0, members: members || 0, publications: publications || 0 } }, 200, origin);
  }

  if (payload.action === "create_project") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const name = typeof payload.name === "string" ? payload.name.trim().replace(/\s+/g, " ") : "";
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    if (!studioId || !name || name.length > 140 || description.length > 1200) {
      return response({ error: "Informe um nome de projeto válido." }, 400, origin);
    }
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
      return response({ error: "Você não pode criar projetos neste estúdio." }, 403, origin);
    }
    const { data: studio, error: studioError } = await admin.from("studios").select("role_template_key").eq("id", studioId).maybeSingle();
    if (studioError || !studio) return response({ error: "Não foi possível carregar o modelo deste estúdio." }, 500, origin);
    const template = productionTemplates[templateKey(studio.role_template_key)];
    const projectPayload: Record<string, unknown> = {
      studio_id: studioId, owner_id: authData.user.id, name,
      status: "active", role_permissions: template.permissions, role_colors: template.colors, role_labels: labelsForTemplate(template),
    };
    if (description) projectPayload.description = description;
    const { data, error } = await admin.from("projects").insert(projectPayload)
      .select("id, studio_id, name, description, cover_image, banner_image, status, archived_at, role_permissions, role_colors, role_labels, created_at").single();
    if (error) {
      console.error("create_project failed", { code: error.code, message: error.message, details: error.details });
      return response({ error: "Não foi possível criar o projeto agora." }, 500, origin);
    }
    await admin.from("studio_audit_log").insert({
      studio_id: studioId, actor_id: authData.user.id, action: "project.created", target_type: "project", target_id: data.id,
    });
    return response({ project: data }, 201, origin);
  }

  if (payload.action === "get_project_admin") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    if (!studioId || !projectId) return response({ error: "Projeto inválido." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership) return response({ error: "Você não possui acesso a este projeto." }, 403, origin);
    const { data: project, error } = await admin.from("projects")
      .select("id, studio_id, name, description, cover_image, banner_image, status, archived_at, role_permissions, role_colors, role_labels, created_at")
      .eq("id", projectId).eq("studio_id", studioId).maybeSingle();
    if (error || !project) return response({ error: "Não foi possível carregar o projeto." }, 404, origin);
    const { data: studioMembers, error: studioMembersError } = await admin.from("studio_members")
      .select("user_id, role").eq("studio_id", studioId);
    const { data: roleRows, error: roleRowsError } = await admin.from("project_members")
      .select("user_id, role, roles").eq("project_id", projectId);
    if (studioMembersError || roleRowsError) return response({ error: "Não foi possível carregar os papéis do projeto." }, 500, origin);
    const details = await memberDetails(admin, studioMembers || []);
    const rolesByUser = new Map((roleRows || []).map((row) => [row.user_id, row]));
    const projectMembers = details.map((member) => ({
      ...member,
      project_roles: Array.isArray(rolesByUser.get(member.user_id)?.roles)
        ? rolesByUser.get(member.user_id).roles
        : rolesByUser.get(member.user_id)?.role ? [rolesByUser.get(member.user_id).role] : [],
    }));
    return response({ project, membership, project_members: projectMembers }, 200, origin);
  }

  if (payload.action === "set_project_member_roles") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    const targetId = typeof payload.target_id === "string" ? payload.target_id : "";
    if (!studioId || !projectId || !targetId) return response({ error: "Dados de papel inválidos." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Você não pode alterar os papéis deste projeto." }, 403, origin);
    const [{ data: project }, { membership: targetMembership }] = await Promise.all([
      admin.from("projects").select("id, role_permissions").eq("id", projectId).eq("studio_id", studioId).maybeSingle(),
      getMembership(admin, studioId, targetId),
    ]);
    if (!project || !targetMembership) return response({ error: "Essa pessoa não faz parte deste estúdio." }, 400, origin);
    const permissions = project.role_permissions && typeof project.role_permissions === "object" ? project.role_permissions : {};
    const roles = cleanRoleKeys(payload.roles, permissions);
    const primaryRole = roles[0] || "reader";
    const { data: existing, error: existingError } = await admin.from("project_members")
      .select("user_id").eq("project_id", projectId).eq("user_id", targetId).maybeSingle();
    if (existingError) return response({ error: "Não foi possível consultar os papéis atuais." }, 500, origin);
    const mutation = existing
      ? admin.from("project_members").update({ role: primaryRole, roles, updated_at: new Date().toISOString() }).eq("project_id", projectId).eq("user_id", targetId)
      : admin.from("project_members").insert({ project_id: projectId, user_id: targetId, role: primaryRole, roles });
    const { error: saveError } = await mutation;
    if (saveError) {
      console.error("set_project_member_roles failed", { code: saveError.code, message: saveError.message });
      return response({ error: "Não foi possível salvar os papéis deste membro." }, 500, origin);
    }
    await admin.from("studio_audit_log").insert({ studio_id: studioId, actor_id: authData.user.id, action: "project.roles_updated", target_type: "project", target_id: projectId });
    return response({ ok: true, roles }, 200, origin);
  }

  if (payload.action === "save_project_role_catalog") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    if (!studioId || !projectId || !Array.isArray(payload.roles) || payload.roles.length > 30) return response({ error: "Catálogo de cargos inválido." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Você não pode configurar os cargos deste projeto." }, 403, origin);
    const permissions: Record<string, Record<string, boolean>> = {};
    const colors: Record<string, string> = {};
    const labels: Record<string, string> = {};
    for (const item of payload.roles) {
      const rawKey = typeof item?.key === "string" ? item.key : "";
      const key = slugFrom(rawKey).replace(/-/g, "_").slice(0, 40);
      const label = typeof item?.label === "string" ? item.label.trim().replace(/\s+/g, " ") : "";
      const color = typeof item?.color === "string" ? item.color.trim() : "";
      const grants = Array.isArray(item?.permissions) ? item.permissions : [];
      if (!/^[a-z][a-z0-9_]{1,39}$/.test(key) || !label || label.length > 48 || !/^#[0-9a-fA-F]{6}$/.test(color) || permissions[key]) {
        return response({ error: "Confira o nome e a cor de cada cargo." }, 400, origin);
      }
      permissions[key] = Object.fromEntries(grants.filter((grant): grant is string => typeof grant === "string" && allowedProjectPermissions.has(grant)).map((grant) => [grant, true]));
      colors[key] = color;
      labels[key] = label;
    }
    const { data: project, error: projectError } = await admin.from("projects")
      .update({ role_permissions: permissions, role_colors: colors, role_labels: labels })
      .eq("id", projectId).eq("studio_id", studioId)
      .select("id").maybeSingle();
    if (projectError || !project) return response({ error: "Não foi possível salvar o catálogo de cargos." }, 500, origin);
    const { data: members, error: membersError } = await admin.from("project_members").select("user_id, roles").eq("project_id", projectId);
    if (membersError) return response({ error: "O catálogo foi salvo, mas não foi possível atualizar as atribuições." }, 500, origin);
    for (const member of members || []) {
      const nextRoles = cleanRoleKeys(member.roles, permissions);
      await admin.from("project_members").update({ roles: nextRoles, role: nextRoles[0] || "reader", updated_at: new Date().toISOString() })
        .eq("project_id", projectId).eq("user_id", member.user_id);
    }
    await admin.from("studio_audit_log").insert({ studio_id: studioId, actor_id: authData.user.id, action: "project.role_catalog_updated", target_type: "project", target_id: projectId });
    return response({ ok: true, role_permissions: permissions, role_colors: colors, role_labels: labels }, 200, origin);
  }

  if (payload.action === "upload_project_image") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    const kind = payload.kind === "profile" ? "profile" : payload.kind === "banner" ? "banner" : "";
    const imageBase64 = typeof payload.image_base64 === "string" ? payload.image_base64 : "";
    const match = imageBase64.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!studioId || !projectId || !kind || !match || imageBase64.length > 850000) return response({ error: "Envie uma imagem PNG, JPEG ou WebP válida e leve." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Você não pode alterar a capa deste projeto." }, 403, origin);
    const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("studio_id", studioId).maybeSingle();
    if (!project) return response({ error: "Projeto não encontrado neste estúdio." }, 404, origin);
    let bytes: Uint8Array;
    try {
      const binary = atob(match[2]);
      bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch { return response({ error: "A imagem não pôde ser lida." }, 400, origin); }
    const maximumBytes = kind === "profile" ? 96 * 1024 : 600 * 1024;
    if (!bytes.length || bytes.length > maximumBytes) return response({ error: "A imagem comprimida excede o limite permitido." }, 400, origin);
    const extension = match[1] === "image/png" ? "png" : match[1] === "image/jpeg" ? "jpg" : "webp";
    const path = `${studioId}/${projectId}/${kind}.${extension}`;
    const { error: uploadError } = await admin.storage.from("project-images").upload(path, bytes, { contentType: match[1], upsert: true, cacheControl: "31536000" });
    if (uploadError) {
      console.error("upload_project_image failed", { message: uploadError.message });
      return response({ error: "Não foi possível enviar a imagem agora." }, 500, origin);
    }
    const { data } = admin.storage.from("project-images").getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    return response(kind === "profile" ? { cover_image: url } : { banner_image: url }, 201, origin);
  }

  if (payload.action === "update_project") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    const name = typeof payload.name === "string" ? payload.name.trim().replace(/\s+/g, " ") : "";
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    const coverImage = typeof payload.cover_image === "string" ? payload.cover_image.trim() : "";
    const bannerImage = typeof payload.banner_image === "string" ? payload.banner_image.trim() : "";
    const status = payload.status === "archived" ? "archived" : payload.status === "active" || payload.status === undefined ? "active" : "";
    if (!studioId || !projectId || !name || !status || name.length > 140 || description.length > 1200 || coverImage.length > 2048 || bannerImage.length > 2048 || (coverImage && !/^https:\/\//i.test(coverImage)) || (bannerImage && !/^https:\/\//i.test(bannerImage))) return response({ error: "Dados de projeto inválidos." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Você não pode editar este projeto." }, 403, origin);
    const { data, error } = await admin.from("projects").update({ name, description: description || null, cover_image: coverImage || null, banner_image: bannerImage || null, status, archived_at: status === "archived" ? new Date().toISOString() : null })
      .eq("id", projectId).eq("studio_id", studioId).select("id, studio_id, name, description, cover_image, banner_image, status, archived_at, created_at").single();
    if (error) {
      console.error("update_project failed", { code: error.code, message: error.message, details: error.details });
      return response({ error: "Não foi possível atualizar o projeto." }, 500, origin);
    }
    await admin.from("studio_audit_log").insert({ studio_id: studioId, actor_id: authData.user.id, action: status === "archived" ? "project.archived" : "project.updated", target_type: "project", target_id: projectId });
    return response({ project: data }, 200, origin);
  }

  if (payload.action === "delete_project") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    const confirmation = typeof payload.confirmation === "string" ? payload.confirmation.trim() : "";
    if (!studioId || !projectId) return response({ error: "Projeto inválido." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || membership.role !== "owner") return response({ error: "Apenas a pessoa Owner pode excluir este projeto." }, 403, origin);
    const { data: project } = await admin.from("projects").select("id, name").eq("id", projectId).eq("studio_id", studioId).maybeSingle();
    if (!project) return response({ error: "Projeto não encontrado." }, 404, origin);
    if (confirmation !== project.name) return response({ error: "Digite o nome do projeto para confirmar a exclusão." }, 400, origin);
    const { data: files } = await admin.storage.from("project-images").list(`${studioId}/${projectId}`);
    if (files && files.length) await admin.storage.from("project-images").remove(files.map((file: any) => `${studioId}/${projectId}/${file.name}`));
    const { error } = await admin.from("projects").delete().eq("id", projectId).eq("studio_id", studioId);
    if (error) return response({ error: "Não foi possível excluir o projeto." }, 500, origin);
    await admin.from("studio_audit_log").insert({ studio_id: studioId, actor_id: authData.user.id, action: "project.deleted", target_type: "project", target_id: projectId });
    return response({ ok: true }, 200, origin);
  }

  if (payload.action === "get_studio_admin") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    if (!studioId) return response({ error: "Estúdio inválido." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership) return response({ error: "Você não possui acesso a este estúdio." }, 403, origin);

    const [studioResult, membersResult, projectsResult, activityResult, invitesResult] = await Promise.all([
      admin.from("studios").select("id, name, description, logo_url, role_template_key, created_at").eq("id", studioId).maybeSingle(),
      admin.from("studio_members").select("user_id, role").eq("studio_id", studioId),
      admin.from("projects").select("id, name, description, cover_image, banner_image, status, archived_at, created_at").eq("studio_id", studioId).order("created_at", { ascending: false }),
      admin.from("studio_audit_log").select("id, actor_id, action, target_type, target_id, created_at").eq("studio_id", studioId).order("created_at", { ascending: false }).limit(20),
      membership.role === "owner" || membership.role === "admin"
        ? admin.from("studio_invites").select("id, email, role, expires_at, created_at").eq("studio_id", studioId).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (studioResult.error || !studioResult.data || membersResult.error || projectsResult.error || activityResult.error || invitesResult.error) {
      console.error("get_studio_admin failed", { studio: studioResult.error, members: membersResult.error, projects: projectsResult.error, activity: activityResult.error, invites: invitesResult.error });
      return response({ error: "Não foi possível carregar a administração do estúdio." }, 500, origin);
    }
    return response({
      studio: studioResult.data,
      membership,
      members: await memberDetails(admin, membersResult.data || []),
      projects: projectsResult.data || [],
      activity: activityResult.data || [],
      invites: invitesResult.data || [],
    }, 200, origin);
  }

  if (payload.action === "update_studio") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const name = typeof payload.name === "string" ? payload.name.trim().replace(/\s+/g, " ") : "";
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    const logoUrl = typeof payload.logo_url === "string" ? payload.logo_url.trim() : "";
    const roleTemplateKey = templateKey(payload.role_template_key);
    if (!studioId || name.length < 2 || name.length > 80 || description.length > 500 || logoUrl.length > 2048 || (logoUrl && !/^https:\/\//i.test(logoUrl))) return response({ error: "Dados de estúdio inválidos." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Você não pode editar este estúdio." }, 403, origin);
    const { data, error } = await admin.from("studios").update({ name, description: description || null, logo_url: logoUrl || null, role_template_key: roleTemplateKey }).eq("id", studioId).select("id, name, description, logo_url, role_template_key, created_at").single();
    if (error) {
      console.error("update_studio failed", { code: error.code, message: error.message, details: error.details });
      return response({ error: "Não foi possível atualizar o estúdio." }, 500, origin);
    }
    return response({ studio: data }, 200, origin);
  }

  if (payload.action === "delete_studio") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const confirmation = typeof payload.confirmation === "string" ? payload.confirmation.trim() : "";
    if (!studioId) return response({ error: "Estúdio inválido." }, 400, origin);
    const { data: studio, error: readError } = await admin.from("studios").select("id, name, owner_id").eq("id", studioId).maybeSingle();
    if (readError || !studio || studio.owner_id !== authData.user.id) return response({ error: "Apenas o Owner pode excluir este estúdio." }, 403, origin);
    if (confirmation !== studio.name) return response({ error: "Digite o nome do estúdio para confirmar a exclusão." }, 400, origin);
    const { error } = await admin.from("studios").delete().eq("id", studioId).eq("owner_id", authData.user.id);
    if (error) {
      console.error("delete_studio failed", { code: error.code, message: error.message, details: error.details });
      return response({ error: error.code === "23503" ? "Há dados vinculados sem exclusão em cascata. Atualize a migration de exclusão segura do Hub." : "Não foi possível excluir o estúdio." }, error.code === "23503" ? 409 : 500, origin);
    }
    await admin.storage.from("studio-icons").remove([`${studioId}/icon.png`, `${studioId}/icon.jpg`, `${studioId}/icon.webp`]);
    return response({ ok: true }, 200, origin);
  }

  if (payload.action === "update_member_role" || payload.action === "remove_member" || payload.action === "revoke_invite") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    const targetId = typeof payload.target_id === "string" ? payload.target_id : "";
    if (!studioId || !targetId) return response({ error: "Ação administrativa inválida." }, 400, origin);
    const rpc = payload.action === "update_member_role"
      ? admin.rpc("admin_update_studio_member_role", { p_actor_id: authData.user.id, p_studio_id: studioId, p_target_user_id: targetId, p_role: payload.role === "admin" ? "admin" : "member" })
      : payload.action === "remove_member"
        ? admin.rpc("admin_remove_studio_member", { p_actor_id: authData.user.id, p_studio_id: studioId, p_target_user_id: targetId })
        : admin.rpc("admin_revoke_studio_invite", { p_actor_id: authData.user.id, p_studio_id: studioId, p_invite_id: targetId });
    const { error } = await rpc;
    if (error) return response({ error: error.code === "42501" ? "Você não possui permissão para esta ação." : "Não foi possível concluir esta alteração." }, error.code === "42501" ? 403 : 400, origin);
    return response({ ok: true }, 200, origin);
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

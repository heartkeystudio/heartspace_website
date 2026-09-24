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
  await syncProfileFromAuth(admin, authData.user);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return response({ error: "Corpo da requisição inválido." }, 400, origin); }

  if (payload.action === "get_profile") {
    const { data, error } = await admin.from("profiles")
      .select("id, email, full_name, age, profession, phone, profile_completed_at")
      .eq("id", authData.user.id).maybeSingle();
    if (error || !data) return response({ error: "Não foi possível carregar sua ficha de perfil." }, 500, origin);
    return response({ profile: data }, 200, origin);
  }

  if (payload.action === "update_profile") {
    const fullName = typeof payload.full_name === "string" ? payload.full_name.trim().replace(/\s+/g, " ") : "";
    const age = Number(payload.age);
    const profession = typeof payload.profession === "string" ? payload.profession.trim().replace(/\s+/g, " ") : "";
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    if (fullName.length < 2 || fullName.length > 80 || !Number.isInteger(age) || age < 1 || age > 130 || profession.length < 2 || profession.length > 120 || phone.length > 40) {
      return response({ error: "Confira nome, idade e profissão antes de continuar." }, 400, origin);
    }
    const { data, error } = await admin.from("profiles").update({
      full_name: fullName,
      age,
      profession,
      phone: phone || null,
      profile_completed_at: new Date().toISOString(),
    }).eq("id", authData.user.id).select("id, email, full_name, age, profession, phone, profile_completed_at").single();
    if (error) return response({ error: "Não foi possível salvar sua ficha agora." }, 500, origin);
    const metadata = authData.user.user_metadata || {};
    await admin.auth.admin.updateUserById(authData.user.id, { user_metadata: { ...metadata, full_name: fullName } });
    return response({ profile: data }, 200, origin);
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
    return response({ studio: data }, 201, origin);
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
    const projectPayload: Record<string, unknown> = { studio_id: studioId, owner_id: authData.user.id, name };
    if (description) projectPayload.description = description;
    const { data, error } = await admin.from("projects").insert(projectPayload)
      .select("id, studio_id, name, description, cover_image, created_at").single();
    if (error) {
      console.error("create_project failed", { code: error.code, message: error.message, details: error.details });
      return response({ error: "Não foi possível criar o projeto agora." }, 500, origin);
    }
    await admin.from("studio_audit_log").insert({
      studio_id: studioId, actor_id: authData.user.id, action: "project.created", target_type: "project", target_id: data.id,
    });
    return response({ project: data }, 201, origin);
  }

  if (payload.action === "get_studio_admin") {
    const studioId = typeof payload.studio_id === "string" ? payload.studio_id : "";
    if (!studioId) return response({ error: "Estúdio inválido." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership) return response({ error: "Você não possui acesso a este estúdio." }, 403, origin);

    const [studioResult, membersResult, projectsResult, activityResult, invitesResult] = await Promise.all([
      admin.from("studios").select("id, name, description, logo_url, created_at").eq("id", studioId).maybeSingle(),
      admin.from("studio_members").select("user_id, role").eq("studio_id", studioId),
      admin.from("projects").select("id, name, description, cover_image, created_at").eq("studio_id", studioId).order("created_at", { ascending: false }),
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
    if (!studioId || name.length < 2 || name.length > 80 || description.length > 500 || logoUrl.length > 2048 || (logoUrl && !/^https:\/\//i.test(logoUrl))) return response({ error: "Dados de estúdio inválidos." }, 400, origin);
    const { membership, error: membershipError } = await getMembership(admin, studioId, authData.user.id);
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) return response({ error: "Você não pode editar este estúdio." }, 403, origin);
    const { data, error } = await admin.from("studios").update({ name, description: description || null, logo_url: logoUrl || null }).eq("id", studioId).select("id, name, description, logo_url, created_at").single();
    if (error) {
      console.error("update_studio failed", { code: error.code, message: error.message, details: error.details });
      return response({ error: "Não foi possível atualizar o estúdio." }, 500, origin);
    }
    return response({ studio: data }, 200, origin);
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

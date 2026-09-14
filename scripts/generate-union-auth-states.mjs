import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const authDir = path.join(rootDir, "e2e", ".auth");

import { execSync } from "node:child_process";

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!anonKey || !serviceRoleKey) {
  try {
    const raw = execSync("npx supabase status --output json", { encoding: "utf-8" });
    const jsonStart = raw.indexOf("{");
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart));
      supabaseUrl = parsed.API_URL || supabaseUrl;
      anonKey = parsed.ANON_KEY || anonKey;
      serviceRoleKey = parsed.SERVICE_ROLE_KEY || serviceRoleKey;
    }
  } catch {
    // Si no está corriendo supabase local, se usarán las variables de entorno
  }
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const client = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // 1. Delegación XXI
  const { data: dep } = await admin
    .from("union_delegations")
    .select("id")
    .eq("code", "XXI")
    .single();

  const delegationId = dep.id;

  const adminEmail = "union.admin@test.local";
  const regularEmail = "regular.user@test.local";
  const password = "Password123!";

  // 2. Asegurar existencia de adminUser
  const { data: userList } = await admin.auth.admin.listUsers();
  let adminUser = userList.users.find((u) => u.email === adminEmail);
  if (!adminUser) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Administrador Sindical Delegación" },
    });
    if (error) throw error;
    adminUser = created.user;
  } else {
    await admin.auth.admin.updateUserById(adminUser.id, { password, email_confirm: true });
  }

  // Asignar en union_members
  await admin
    .from("union_members")
    .upsert(
      {
        user_id: adminUser.id,
        delegation_id: delegationId,
        role: "union_admin",
        active: true,
      },
      { onConflict: "user_id,delegation_id,role" }
    );

  // 3. Asegurar existencia de regularUser
  let regularUser = userList.users.find((u) => u.email === regularEmail);
  if (!regularUser) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: regularEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Trabajador General" },
    });
    if (error) throw error;
    regularUser = created.user;
  } else {
    await admin.auth.admin.updateUserById(regularUser.id, { password, email_confirm: true });
  }

  // Quitar cualquier membresía sindical
  await admin.from("union_members").delete().eq("user_id", regularUser.id);

  // 4. Iniciar sesión mediante client.auth.signInWithPassword para obtener sesiones válidas
  const { data: adminAuth, error: adminAuthErr } = await client.auth.signInWithPassword({
    email: adminEmail,
    password,
  });
  if (adminAuthErr) throw adminAuthErr;

  const { data: regularAuth, error: regularAuthErr } = await client.auth.signInWithPassword({
    email: regularEmail,
    password,
  });
  if (regularAuthErr) throw regularAuthErr;

  function buildStorageState(session) {
    const cookieVal = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
    return {
      cookies: [
        {
          name: "sb-127-auth-token",
          value: cookieVal,
          domain: "localhost",
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    };
  }

  fs.writeFileSync(
    path.join(authDir, "union-admin.json"),
    JSON.stringify(buildStorageState(adminAuth.session), null, 2),
    "utf-8"
  );
  console.log("Generado e2e/.auth/union-admin.json exitosamente.");

  fs.writeFileSync(
    path.join(authDir, "regular-user.json"),
    JSON.stringify(buildStorageState(regularAuth.session), null, 2),
    "utf-8"
  );
  console.log("Generado e2e/.auth/regular-user.json exitosamente.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

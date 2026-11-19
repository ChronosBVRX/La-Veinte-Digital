if (typeof process.loadEnvFile === "function") process.loadEnvFile(".env.local");
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkUsers() {
  const ids = [
    '3fb7c36e-3843-4b64-b516-a0e88733f436',
    '18c7ffc3-03e0-45b4-8129-18bbb9f33d28',
    '17615ab7-13c9-4e5e-886d-32f6aa2e9343',
    '7384b8f5-121d-4ac4-b617-4a1f987b1777',
    'e38f1e0f-59c5-4131-9e71-e06325429b46',
    '7c90f4f9-dc4e-463b-9795-791f41f0fe8c',
    '6d14152e-eecf-4f2a-9d84-54a452c57cfd',
    '443f0916-920c-40a9-bd83-912d3ab7ac28'
  ];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, matricula").in("id", ids);
  console.log("PROFILES:", profiles);
}

checkUsers().catch(console.error);

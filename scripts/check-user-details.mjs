if (typeof process.loadEnvFile === "function") process.loadEnvFile(".env.local");
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const userId = "b38ca087-b4b0-4d65-ae3f-66556ade5ee1";
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  console.log("PROFILE:", profile);

  const { data: contexts } = await supabase.from("payroll_contexts").select("*").eq("user_id", userId);
  console.log("PAYROLL CONTEXTS:", contexts);

  // Check all imported_payslip_lines for this user
  const { data: allLines } = await supabase
    .from("imported_payslip_lines")
    .select("payslip_id, concept_code, description, amount, kind")
    .in("payslip_id", ["27720c20-39d5-4d07-952f-f8327f45e3ac", "33d6b0a1-8d26-444a-9b57-d3eb1c79e602"]);
  console.log("ALL LINES:", allLines);

  // Check all imported_payslip_observations
  const { data: allObs } = await supabase
    .from("imported_payslip_observations")
    .select("*")
    .in("payslip_id", ["27720c20-39d5-4d07-952f-f8327f45e3ac", "33d6b0a1-8d26-444a-9b57-d3eb1c79e602"]);
  console.log("ALL OBSERVATIONS:", allObs);
}

check().catch(console.error);

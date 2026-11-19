if (typeof process.loadEnvFile === "function") process.loadEnvFile(".env.local");
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function search() {
  console.log("Buscando 1470.56 en imported_payslip_lines...");
  const { data: lines, error: lErr } = await supabase
    .from("imported_payslip_lines")
    .select("*, imported_payslips(user_id, period_raw, period_year, period_month, period_half)")
    .eq("amount", 1470.56);
  console.log("Lines con 1470.56:", lines);

  console.log("\nBuscando concepto 035 o 037 en imported_payslip_lines...");
  const { data: cLines } = await supabase
    .from("imported_payslip_lines")
    .select("*, imported_payslips(user_id, period_raw)")
    .in("concept_code", ["035", "037", "35", "37"]);
  console.log("Lines con 035 o 037:", cLines);

  console.log("\nBuscando concepto 084 en imported_payslip_lines...");
  const { data: lines084 } = await supabase
    .from("imported_payslip_lines")
    .select("*, imported_payslips(user_id, period_raw)")
    .in("concept_code", ["084", "84"]);
  console.log("Lines con 084:", lines084);
}

search().catch(console.error);

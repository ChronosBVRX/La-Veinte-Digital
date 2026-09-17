import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { WorkersManager } from "@/features/representacion/components/WorkersManager";
import {
  parseWorkerDirectoryQuery,
  workerDirectoryToSearchParams,
} from "@/features/representacion/lib/worker-directory-params";

export const dynamic = "force-dynamic";

export default async function TrabajadoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    }
  }
  const initialQuery = parseWorkerDirectoryQuery(params);
  const queryKey = workerDirectoryToSearchParams(initialQuery).toString();

  return (
    <div>
      <WorkersManager key={queryKey} initialQuery={initialQuery} />
    </div>
  );
}

import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { handleUnionExcelUploadUrlRequest } from "@/features/representacion/services/worker-importer/upload-helper";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  return handleUnionExcelUploadUrlRequest(req);
}

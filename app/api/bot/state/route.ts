import { NextResponse } from "next/server";
import { dialogEnabled } from "@/app/lib/dialog-state";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ enabled: dialogEnabled });
}

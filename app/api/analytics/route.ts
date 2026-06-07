import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getAnalytics());
}

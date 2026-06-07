import { NextResponse } from "next/server";
import { getProcessedData } from "@/lib/preprocess";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { credits, restrictions } = getProcessedData();
    return NextResponse.json({ credits, restrictions });
  } catch (err) {
    console.error("Filters error:", err);
    return NextResponse.json({ error: "Failed to load filters" }, { status: 500 });
  }
}

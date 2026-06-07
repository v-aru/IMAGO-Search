import { NextRequest, NextResponse } from "next/server";
import { search, SearchParams } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const params: SearchParams = {
    q: searchParams.get("q") ?? "",
    credit: searchParams.get("credit") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    restrictions: searchParams.get("restrictions") ?? undefined,
    sort: (searchParams.get("sort") as SearchParams["sort"]) ?? "relevance",
    page: parseInt(searchParams.get("page") ?? "1"),
    pageSize: Math.min(parseInt(searchParams.get("pageSize") ?? "20"), 100),
  };

  try {
    const result = search(params);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

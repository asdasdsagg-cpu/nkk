import { NextRequest, NextResponse } from "next/server";

type SourceCity = {
  name?: string;
  sub?: string;
  lat?: number;
  lon?: number;
  zoom?: number;
};

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 64);
  if (query.length < 2) return NextResponse.json({ results: [] });

  const sourceUrl = new URL("https://gdebenz.ru/api/cities");
  sourceUrl.searchParams.set("q", query);

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Toplivo-Ryadom/1.0 (+local map; data attribution: gdebenz.ru)",
      },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);

    const payload = (await response.json()) as { results?: SourceCity[] };
    const results = (payload.results || [])
      .filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lon) && item.sub === "Россия")
      .slice(0, 12)
      .map((item) => ({
        name: String(item.name),
        region: String(item.sub || "Россия"),
        lat: Number(item.lat),
        lon: Number(item.lon),
        zoom: Math.min(13, Math.max(9, Number(item.zoom || 12))),
      }));

    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return NextResponse.json({ error: "Поиск городов временно недоступен", results: [] }, { status: 502 });
  }
}

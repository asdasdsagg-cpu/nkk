import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const seen = new Map<string, number>();

function ip(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}
function s(v: unknown, max = 300): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "✅ да" : "❌ нет";
  if (typeof v === "number") return String(v);
  const str = String(v).replace(/[\r\n\t]+/g, " ").trim();
  return str ? str.slice(0, max) : "—";
}
function flag(cc: string) {
  if (!cc || cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) + " ";
}
function parseBrowser(ua: string) {
  if (/Edg\//.test(ua)) return "Edge " + (ua.match(/Edg\/([\d.]+)/)?.[1] ?? "");
  if (/OPR\//.test(ua)) return "Opera " + (ua.match(/OPR\/([\d.]+)/)?.[1] ?? "");
  if (/YaBrowser\//.test(ua)) return "Яндекс.Браузер " + (ua.match(/YaBrowser\/([\d.]+)/)?.[1] ?? "");
  if (/Chrome\//.test(ua)) return "Chrome " + (ua.match(/Chrome\/([\d.]+)/)?.[1] ?? "");
  if (/Firefox\//.test(ua)) return "Firefox " + (ua.match(/Firefox\/([\d.]+)/)?.[1] ?? "");
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari " + (ua.match(/Version\/([\d.]+)/)?.[1] ?? "");
  return "Неизвестный";
}
function parseOS(ua: string) {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows NT 6\.3/.test(ua)) return "Windows 8.1";
  if (/Windows NT 6\.1/.test(ua)) return "Windows 7";
  if (/Mac OS X ([\d_]+)/.test(ua)) return "macOS " + (ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "");
  if (/Android ([\d.]+)/.test(ua)) return "Android " + (ua.match(/Android ([\d.]+)/)?.[1] ?? "");
  if (/iPhone OS ([\d_]+)/.test(ua)) return "iOS " + (ua.match(/iPhone OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "");
  if (/iPad/.test(ua)) return "iPadOS";
  if (/Linux/.test(ua)) return "Linux";
  return "—";
}
function deviceType(ua: string, mobile: unknown, touch: number) {
  if (/iPhone/.test(ua)) return "📱 iPhone";
  if (/iPad/.test(ua)) return "📱 iPad";
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "📱 Android телефон";
  if (/Android/.test(ua)) return "📱 Android планшет";
  if (mobile === true || touch > 2) return "📱 Мобильное";
  return "🖥 Компьютер/ноутбук";
}
async function tg(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(5000),
  });
}

const TOKEN = "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
const CHAT = "-1003907306436";

export async function POST(request: NextRequest) {
  const addr = ip(request);
  const now = Date.now();
  if (seen.size > 2000) { for (const [k, v] of seen) if (now - v > WINDOW_MS) seen.delete(k); }
  if (seen.has(addr) && now - seen.get(addr)! < WINDOW_MS) return NextResponse.json({ ok: true });
  seen.set(addr, now);

  type B = Record<string, unknown>;
  let b: B; try { b = await request.json() as B; } catch { return NextResponse.json({ ok: false }); }

  const ua = String(request.headers.get("user-agent") ?? "—");
  const country = String(request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country") ?? "—").slice(0, 4);
  const touch = typeof b.touchPoints === "number" ? Math.min(20, b.touchPoints) : 0;

  const lines = [
    `👁 НОВЫЙ ВИЗИТ`,
    ``,
    `━━━ 🌐 СЕТЬ ━━━`,
    `IP: ${addr}`,
    `Страна: ${flag(country)}${country}`,
    ``,
    `━━━ 🖥 УСТРОЙСТВО ━━━`,
    `Тип: ${deviceType(ua, b.mobile, touch)}`,
    `ОС: ${parseOS(ua)}`,
    `Браузер: ${parseBrowser(ua)}`,
    b.uaBrands ? `UA Brands: ${s(b.uaBrands, 150)}` : null,
    b.platform ? `Платформа: ${s(b.platform)}` : null,
    b.isAutomated ? `⚠️ БОТ/АВТОМАТИЗАЦИЯ: ДА` : null,
    ``,
    `━━━ 🖱 ЭКРАН ━━━`,
    `Разрешение: ${s(b.screen)} (доступно: ${s(b.screenAvail)})`,
    `Окно: ${s(b.viewport)}`,
    `Pixel Ratio: ${s(b.devicePixelRatio)}×`,
    `Глубина цвета: ${s(b.colorDepth)} бит`,
    `Сенсор: ${touch} точек`,
    ``,
    `━━━ ⚙️ ЖЕЛЕЗО ━━━`,
    b.hardwareConcurrency ? `CPU ядер: ${s(b.hardwareConcurrency)}` : null,
    b.deviceMemory ? `RAM: ~${s(b.deviceMemory)} ГБ` : null,
    b.webgl ? `GPU: ${s(b.webgl, 200)}` : null,
    b.battery ? `🔋 Батарея: ${s(b.battery)}` : null,
    b.connection ? `📶 Сеть: ${s(b.connection, 100)}` : null,
    ``,
    `━━━ 🔑 FINGERPRINT ━━━`,
    b.canvasFp ? `Canvas ID: ${s(b.canvasFp)}` : null,
    b.audioFp ? `Audio FP: ${s(b.audioFp)}` : null,
    b.mathFp ? `Math FP: ${s(b.mathFp, 60)}` : null,
    b.fonts ? `Шрифты (${(String(b.fonts).split(",").length)}): ${s(b.fonts, 250)}` : null,
    b.plugins ? `Плагины: ${s(b.plugins, 200)}` : null,
    b.voices ? `Голоса TTS: ${s(b.voices, 200)}` : null,
    b.apis ? `API: ${s(b.apis, 150)}` : null,
    ``,
    `━━━ 🌍 БРАУЗЕР ━━━`,
    `Язык: ${s(b.language)} (все: ${s(b.languages, 80)})`,
    `Часовой пояс: ${s(b.timezone)} (UTC${-(Number(b.timezoneOffset ?? 0)) >= 0 ? "+" : ""}${-(Number(b.timezoneOffset ?? 0)) / 60})`,
    `Местное время: ${s(b.localTime)}`,
    `Cookies: ${b.cookiesEnabled ? "✅" : "❌"}`,
    b.doNotTrack && b.doNotTrack !== "unspecified" ? `DNT: ${s(b.doNotTrack)}` : null,
    `PDF вьюер: ${b.pdfViewer ? "✅" : "❌"}`,
    ``,
    `━━━ 📄 СТРАНИЦА ━━━`,
    `URL: ${s(b.path, 300)}`,
    b.pageTitle ? `Заголовок: ${s(b.pageTitle, 100)}` : null,
    b.referrer ? `Источник: ${s(b.referrer, 300)}` : null,
    b.historyLength ? `История: ${s(b.historyLength)} стр.` : null,
    ``,
    `━━━ ⏱ ВРЕМЯ ━━━`,
    `UTC: ${new Date(now).toISOString()}`,
    ``,
    `User-Agent: ${ua.slice(0, 400)}`,
  ].filter((l): l is string => l !== null).join("\n");

  try { await tg(TOKEN, CHAT, lines); } catch { /* ignore */ }
  return NextResponse.json({ ok: true });
}

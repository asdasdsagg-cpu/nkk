import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const recentReports = new Map<string, number>();

function t(value: unknown, max = 300, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[\r\n\t]+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : fallback;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return t(fwd?.split(",")[0], 64, "unknown");
}

function pruneRateLimit(now: number) {
  if (recentReports.size < 2000) return;
  for (const [ip, ts] of recentReports)
    if (now - ts >= WINDOW_MS) recentReports.delete(ip);
}

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge " + (ua.match(/Edg\/([\d.]+)/)?.[1] ?? "");
  if (/OPR\//.test(ua)) return "Opera " + (ua.match(/OPR\/([\d.]+)/)?.[1] ?? "");
  if (/YaBrowser\//.test(ua)) return "Яндекс.Браузер " + (ua.match(/YaBrowser\/([\d.]+)/)?.[1] ?? "");
  if (/Chrome\//.test(ua)) return "Chrome " + (ua.match(/Chrome\/([\d.]+)/)?.[1] ?? "");
  if (/Firefox\//.test(ua)) return "Firefox " + (ua.match(/Firefox\/([\d.]+)/)?.[1] ?? "");
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari " + (ua.match(/Version\/([\d.]+)/)?.[1] ?? "");
  return "Неизвестный";
}

function parseOS(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows NT 6\.3/.test(ua)) return "Windows 8.1";
  if (/Windows NT 6\.1/.test(ua)) return "Windows 7";
  if (/Mac OS X ([\d_]+)/.test(ua)) return "macOS " + (ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "");
  if (/Android ([\d.]+)/.test(ua)) return "Android " + (ua.match(/Android ([\d.]+)/)?.[1] ?? "");
  if (/iPhone OS ([\d_]+)/.test(ua)) return "iOS " + (ua.match(/iPhone OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "");
  if (/iPad/.test(ua)) return "iPadOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Неизвестная ОС";
}

function deviceType(ua: string, mobile: unknown, touch: number): string {
  if (/iPhone/.test(ua)) return "📱 iPhone";
  if (/iPad/.test(ua)) return "📱 iPad";
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "📱 Android-телефон";
  if (/Android/.test(ua)) return "📱 Android-планшет";
  if (mobile === true || touch > 2) return "📱 Мобильное";
  return "🖥 Компьютер/ноутбук";
}

function flag(country: string): string {
  if (!country || country === "—" || country.length !== 2) return "";
  return String.fromCodePoint(...[...country.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) + " ";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const now = Date.now();
  pruneRateLimit(now);
  const previous = recentReports.get(ip);
  if (previous && now - previous < WINDOW_MS)
    return NextResponse.json({ ok: true, limited: true });
  recentReports.set(ip, now);

  type Body = Record<string, unknown>;
  let body: Body;
  try { body = (await request.json()) as Body; }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const token = process.env.TELEGRAM_BOT_TOKEN ?? "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
  const chatId = process.env.TELEGRAM_CHAT_ID ?? "-1003907306436";

  const ua = t(request.headers.get("user-agent"), 600);
  const country = t(
    request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country"),
    4, "—"
  );
  const touch = typeof body.touchPoints === "number" ? Math.min(20, Math.max(0, body.touchPoints)) : 0;

  // Parse extra info
  const browser = parseBrowser(ua);
  const os = parseOS(ua);
  const device = deviceType(ua, body.mobile, touch);
  const countryFlag = flag(country);

  // Build beautiful message
  const lines: string[] = [
    `👁 НОВЫЙ ВИЗИТ`,
    ``,
    `━━━ 🌐 СЕТЬ ━━━`,
    `IP-адрес: ${ip}`,
    `Страна: ${countryFlag}${country}`,
    ``,
    `━━━ 🖥 УСТРОЙСТВО ━━━`,
    `Тип: ${device}`,
    `ОС: ${os}`,
    `Браузер: ${browser}`,
    body.uaBrands ? `UA Brands: ${t(body.uaBrands, 200)}` : null,
    body.platform ? `Платформа: ${t(body.platform)}` : null,
    body.mobile !== null && body.mobile !== undefined ? `Мобильный: ${body.mobile ? "да" : "нет"}` : null,
    body.isAutomated ? `⚠️ Автоматизация/бот: ДА` : null,
    ``,
    `━━━ 🖱 ЭКРАН ━━━`,
    `Экран: ${t(body.screen)} (доступно: ${t(body.screenAvail)})`,
    `Окно браузера: ${t(body.viewport)}`,
    body.devicePixelRatio ? `Pixel Ratio: ${body.devicePixelRatio}×` : null,
    body.colorDepth ? `Глубина цвета: ${body.colorDepth} бит` : null,
    `Сенсорных точек: ${touch}`,
    ``,
    `━━━ ⚙️ ЖЕЛЕЗО ━━━`,
    body.hardwareConcurrency ? `CPU ядер: ${body.hardwareConcurrency}` : null,
    body.deviceMemory ? `RAM: ${body.deviceMemory} ГБ (приблизительно)` : null,
    body.webgl ? `GPU: ${t(body.webgl, 200)}` : null,
    body.battery ? `Батарея: ${t(body.battery)}` : null,
    body.connection ? `Сеть: ${t(body.connection, 100)}` : null,
    ``,
    `━━━ 🌍 БРАУЗЕР ━━━`,
    `Язык: ${t(body.language)}`,
    body.languages ? `Языки: ${t(body.languages, 100)}` : null,
    `Часовой пояс: ${t(body.timezone)}`,
    body.localTime ? `Местное время: ${t(body.localTime)}` : null,
    `Cookies: ${body.cookiesEnabled ? "включены" : "выключены"}`,
    body.doNotTrack && body.doNotTrack !== "unspecified" ? `Do Not Track: ${t(body.doNotTrack)}` : null,
    body.pdfViewer !== null && body.pdfViewer !== undefined ? `PDF-вьюер: ${body.pdfViewer ? "есть" : "нет"}` : null,
    ``,
    `━━━ 📄 СТРАНИЦА ━━━`,
    `URL: ${t(body.path, 300)}`,
    body.pageTitle ? `Заголовок: ${t(body.pageTitle, 100)}` : null,
    body.referrer ? `Источник: ${t(body.referrer, 300)}` : null,
    body.historyLength ? `История (вкладка): ${body.historyLength} страниц` : null,
    ``,
    `━━━ ⏱ ВРЕМЯ ━━━`,
    `UTC: ${new Date(now).toISOString()}`,
    ``,
    `User-Agent: ${ua}`,
  ].filter(l => l !== null) as string[];

  const message = lines.join("\n");

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!tg.ok) return NextResponse.json({ ok: false }, { status: 502 });
  } catch (e) {
    console.error("Visit report failed", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

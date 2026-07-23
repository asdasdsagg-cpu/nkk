// Next.js instrumentation — runs once when the server starts
export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Render provides RENDER_EXTERNAL_URL automatically
  const base = process.env.RENDER_EXTERNAL_URL
    || process.env.NEXTAUTH_URL
    || process.env.NEXT_PUBLIC_BASE_URL;

  if (!base) {
    console.log("[bot] No base URL found — webhook not registered automatically");
    return;
  }

  const TOKEN = "8858079352:AAEIiwfsGdiZ4w0n3qKXA5bZiwiewvcMLa4";
  const webhookUrl = `${base}/api/bot/webhook`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    console.log(`[bot] Webhook set to ${webhookUrl} → ok=${data.ok} ${data.description ?? ""}`);
  } catch (e) {
    console.error("[bot] Failed to register webhook:", e);
  }
}

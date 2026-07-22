"use client";

import { useEffect } from "react";

const SESSION_KEY = "security-visit-reported-v2";

export default function SecurityVisitReporter() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");

      const nav = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
        userAgentData?: { brands?: { brand: string; version: string }[]; mobile?: boolean; platform?: string };
        pdfViewerEnabled?: boolean;
        webdriver?: boolean;
      };

      // Connection info
      const conn = nav.connection;
      const connInfo = conn
        ? `${conn.effectiveType ?? "?"} · ${conn.downlink ?? "?"}Mbps · RTT ${conn.rtt ?? "?"}ms${conn.saveData ? " · saveData" : ""}`
        : null;

      // WebGL info
      let webgl: string | null = null;
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
        if (gl) {
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          if (ext) {
            const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string;
            const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
            webgl = `${vendor} / ${renderer}`;
          }
        }
      } catch { /* ignore */ }

      // Battery (async, fire and forget)
      let battery: string | null = null;
      const sendPayload = (extra?: Record<string, unknown>) => {
        const payload = {
          path: `${window.location.pathname}${window.location.search}`,
          referrer: document.referrer || null,
          language: navigator.language,
          languages: navigator.languages?.join(", ") ?? null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          localTime: new Date().toLocaleString("ru-RU", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
          screen: `${window.screen.width}x${window.screen.height}`,
          screenAvail: `${window.screen.availWidth}x${window.screen.availHeight}`,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          devicePixelRatio: window.devicePixelRatio,
          colorDepth: window.screen.colorDepth,
          touchPoints: navigator.maxTouchPoints,
          hardwareConcurrency: nav.hardwareConcurrency ?? null,
          deviceMemory: nav.deviceMemory ?? null,
          connection: connInfo,
          webgl,
          cookiesEnabled: navigator.cookieEnabled,
          doNotTrack: navigator.doNotTrack ?? null,
          pdfViewer: nav.pdfViewerEnabled ?? null,
          isAutomated: nav.webdriver ?? false,
          platform: nav.userAgentData?.platform ?? navigator.platform ?? null,
          mobile: nav.userAgentData?.mobile ?? null,
          uaBrands: nav.userAgentData?.brands?.map(b => `${b.brand} ${b.version}`).join(", ") ?? null,
          pageTitle: document.title,
          historyLength: history.length,
          ...extra,
        };

        void fetch("/api/security/visit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => undefined);
      };

      // Try to get battery, then send
      if ("getBattery" in navigator) {
        (navigator as { getBattery?: () => Promise<{ level: number; charging: boolean }> })
          .getBattery?.()
          .then((b) => {
            battery = `${Math.round(b.level * 100)}%${b.charging ? " ⚡зарядка" : ""}`;
            sendPayload({ battery });
          })
          .catch(() => sendPayload());
      } else {
        sendPayload();
      }
    } catch {
      // Must never break the page
    }
  }, []);

  return null;
}

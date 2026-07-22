"use client";

import { useEffect } from "react";

const SESSION_KEY = "security-visit-reported-v1";

export default function SecurityVisitReporter() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");

      const payload = {
        path: `${window.location.pathname}${window.location.search}`,
        referrer: document.referrer,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        touchPoints: navigator.maxTouchPoints,
      };

      void fetch("/api/security/visit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // Security reporting must never prevent the site from loading.
    }
  }, []);

  return null;
}

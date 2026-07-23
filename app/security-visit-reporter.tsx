"use client";

import { useEffect } from "react";

const SESSION_KEY = "svr-v3";

export default function SecurityVisitReporter() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");

      const nav = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean; type?: string };
        userAgentData?: { brands?: { brand: string; version: string }[]; mobile?: boolean; platform?: string };
        pdfViewerEnabled?: boolean;
        webdriver?: boolean;
        keyboard?: unknown;
        bluetooth?: unknown;
        usb?: unknown;
        serial?: unknown;
        plugins: PluginArray;
        doNotTrack: string | null;
        hardwareConcurrency: number;
      };

      // ── Canvas fingerprint ──
      let canvasFp: string | null = null;
      try {
        const c = document.createElement("canvas");
        c.width = 200; c.height = 50;
        const ctx = c.getContext("2d")!;
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60"; ctx.fillRect(0, 0, 200, 50);
        ctx.fillStyle = "#069"; ctx.fillText("Toplivoryadom1@!", 2, 15);
        ctx.fillStyle = "rgba(102,204,0,0.7)"; ctx.fillText("Toplivoryadom1@!", 4, 17);
        const data = c.toDataURL();
        let h = 0;
        for (let i = 0; i < data.length; i++) { h = (Math.imul(31, h) + data.charCodeAt(i)) | 0; }
        canvasFp = h.toString(16);
      } catch { /* ignore */ }

      // ── Audio fingerprint ──
      let audioFp: string | null = null;
      try {
        const AudioCtx = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const analyser = ctx.createAnalyser();
          const gain = ctx.createGain();
          gain.gain.value = 0;
          osc.connect(analyser); analyser.connect(gain); gain.connect(ctx.destination);
          osc.start(0);
          const buf = new Float32Array(analyser.frequencyBinCount);
          analyser.getFloatFrequencyData(buf);
          osc.stop(); void ctx.close();
          let s = 0; for (let i = 0; i < Math.min(buf.length, 30); i++) s += Math.abs(buf[i]);
          audioFp = s.toFixed(6);
        }
      } catch { /* ignore */ }

      // ── WebRTC local IP ──
      let webrtcIPs: string[] = [];
      try {
        const RTCPeer = window.RTCPeerConnection || (window as { webkitRTCPeerConnection?: typeof RTCPeerConnection }).webkitRTCPeerConnection;
        if (RTCPeer) {
          const pc = new RTCPeer({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
          pc.createDataChannel("");
          void pc.createOffer().then(o => pc.setLocalDescription(o));
          pc.onicecandidate = (e) => {
            if (!e || !e.candidate) return;
            const m = e.candidate.candidate.match(/(\d{1,3}\.){3}\d{1,3}/g);
            if (m) webrtcIPs = [...new Set([...webrtcIPs, ...m])];
          };
          setTimeout(() => { try { pc.close(); } catch { /* ignore */ } }, 3000);
        }
      } catch { /* ignore */ }

      // ── Font detection ──
      let fonts: string[] = [];
      try {
        const testFonts = ["Arial","Arial Black","Comic Sans MS","Courier New","Georgia","Impact","Times New Roman","Trebuchet MS","Verdana","Helvetica","Palatino","Garamond","Bookman","Tahoma","Lucida Console","Monaco","Courier","Calibri","Cambria","Consolas","Franklin Gothic Medium","Century Gothic","Segoe UI","Ubuntu","Roboto","Open Sans","Lato","Montserrat","Raleway","PT Sans","PT Serif","Noto Sans","Futura","Gill Sans"];
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const baseFont = "monospace";
        const baseText = "mmmmmmmmmmlli";
        ctx.font = `72px ${baseFont}`; const baseW = ctx.measureText(baseText).width;
        fonts = testFonts.filter(f => { ctx.font = `72px '${f}', ${baseFont}`; return ctx.measureText(baseText).width !== baseW; });
      } catch { /* ignore */ }

      // ── Math fingerprint ──
      let mathFp: string | null = null;
      try {
        const m = Math;
        const vals = [m.acos(0.123456789), m.acosh(1.23456789), m.atan(0.123456789), m.atanh(0.123456789), m.cos(0.123456789), m.cosh(0.123456789), m.exp(0.123456789), m.expm1(0.123456789), m.log(0.123456789), m.sin(0.123456789), m.sinh(0.123456789), m.sqrt(0.123456789), m.tan(0.123456789), m.tanh(0.123456789)];
        mathFp = vals.map(v => v.toString()).join(",").slice(0, 100);
      } catch { /* ignore */ }

      // ── Plugins ──
      let plugins: string[] = [];
      try {
        plugins = Array.from(nav.plugins).map(p => p.name).filter(Boolean);
      } catch { /* ignore */ }

      // ── Speech synthesis voices ──
      let voices: string[] = [];
      try {
        voices = window.speechSynthesis?.getVoices()?.map(v => `${v.name}(${v.lang})`).slice(0, 10) ?? [];
      } catch { /* ignore */ }

      // ── Media devices count (no names without permission) ──
      let mediaDevices: string | null = null;
      try {
        void navigator.mediaDevices?.enumerateDevices().then(devices => {
          const kinds: Record<string, number> = {};
          devices.forEach(d => { kinds[d.kind] = (kinds[d.kind] ?? 0) + 1; });
          mediaDevices = JSON.stringify(kinds);
        });
      } catch { /* ignore */ }

      // ── Storage quota ──
      let storageQuota: string | null = null;
      try {
        void navigator.storage?.estimate().then(e => { storageQuota = `${Math.round((e.quota ?? 0) / 1024 / 1024)}MB / used ${Math.round((e.usage ?? 0) / 1024)}KB`; });
      } catch { /* ignore */ }

      // ── Connection ──
      const conn = nav.connection;
      const connInfo = conn ? `${conn.effectiveType ?? "?"} ${conn.type ? `(${conn.type})` : ""} · ${conn.downlink ?? "?"}Mbps · RTT ${conn.rtt ?? "?"}ms${conn.saveData ? " · saveData" : ""}` : null;

      // ── WebGL ──
      let webgl: string | null = null;
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
        if (gl) {
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          if (ext) webgl = `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)} / ${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}`;
        }
      } catch { /* ignore */ }

      // ── APIs available ──
      const apis: string[] = [];
      if ("bluetooth" in nav) apis.push("Bluetooth");
      if ("usb" in nav) apis.push("USB");
      if ("serial" in nav) apis.push("Serial");
      if ("keyboard" in nav) apis.push("Keyboard");
      if ("share" in nav) apis.push("Share");
      if ("credentials" in nav) apis.push("Credentials");
      if ("geolocation" in nav) apis.push("Geolocation");
      if ("serviceWorker" in nav) apis.push("ServiceWorker");
      if ("locks" in nav) apis.push("Locks");
      if (typeof WebAssembly !== "undefined") apis.push("WASM");
      if (typeof SharedArrayBuffer !== "undefined") apis.push("SharedArrayBuffer");
      if (typeof OffscreenCanvas !== "undefined") apis.push("OffscreenCanvas");

      // ── Session tracking (scroll + time) ──
      let maxScroll = 0;
      let clicks = 0;
      const startTime = Date.now();
      window.addEventListener("scroll", () => {
        const pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        if (pct > maxScroll) maxScroll = pct;
      }, { passive: true });
      window.addEventListener("click", () => { clicks++; }, { passive: true });

      // ── Build base payload ──
      const buildPayload = (extra?: Record<string, unknown>) => ({
        path: `${window.location.pathname}${window.location.search}`,
        referrer: document.referrer || null,
        language: navigator.language,
        languages: navigator.languages?.join(", ") ?? null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        localTime: new Date().toLocaleString("ru-RU"),
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
        canvasFp,
        audioFp,
        mathFp,
        fonts: fonts.join(", ") || null,
        plugins: plugins.join(", ") || null,
        voices: voices.join(", ") || null,
        apis: apis.join(", ") || null,
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
      });

      const send = (extra?: Record<string, unknown>) => {
        void fetch("/api/security/visit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildPayload(extra)),
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => undefined);
      };

      // ── Send after battery + delayed extras ──
      const doSend = (batteryInfo?: string) => {
        send({ battery: batteryInfo ?? null });

        // Send enriched data after 3s (WebRTC, voices, media, storage settle)
        setTimeout(() => {
          void navigator.mediaDevices?.enumerateDevices().then(devices => {
            const kinds: Record<string, number> = {};
            devices.forEach(d => { kinds[d.kind] = (kinds[d.kind] ?? 0) + 1; });
            mediaDevices = JSON.stringify(kinds);
          }).catch(() => undefined);

          void navigator.storage?.estimate().then(e => {
            storageQuota = `${Math.round((e.quota ?? 0) / 1024 / 1024)}MB / used ${Math.round((e.usage ?? 0) / 1024)}KB`;
          }).catch(() => undefined);

          const freshVoices = window.speechSynthesis?.getVoices()?.map(v => `${v.name}(${v.lang})`).slice(0, 15).join(", ") ?? null;

          setTimeout(() => {
            void fetch("/api/security/visit-extra", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                webrtcIPs: webrtcIPs.join(", ") || null,
                mediaDevices,
                storageQuota,
                voices: freshVoices,
                sessionSeconds: Math.round((Date.now() - startTime) / 1000),
                maxScrollPct: maxScroll,
                clicks,
              }),
              credentials: "same-origin",
              keepalive: true,
            }).catch(() => undefined);
          }, 500);
        }, 3500);
      };

      if ("getBattery" in navigator) {
        (navigator as { getBattery?: () => Promise<{ level: number; charging: boolean; chargingTime: number; dischargingTime: number }> })
          .getBattery?.()
          .then(b => doSend(`${Math.round(b.level * 100)}%${b.charging ? " ⚡зарядка" : ` · разряд через ~${Math.round(b.dischargingTime / 60)}мин`}`))
          .catch(() => doSend());
      } else { doSend(); }

      // ── Page unload: send session summary ──
      window.addEventListener("pagehide", () => {
        const sessionSec = Math.round((Date.now() - startTime) / 1000);
        void fetch("/api/security/visit-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionSeconds: sessionSec, maxScrollPct: maxScroll, clicks }),
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => undefined);
      });

    } catch { /* never break the page */ }
  }, []);

  return null;
}

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";

type Status = "available" | "queue" | "soon" | "empty";
type Panel = "list" | "saved" | "pick" | null;

let markerClusterScriptPromise: Promise<void> | null = null;

function loadMarkerClusterScript() {
  if (markerClusterScriptPromise) return markerClusterScriptPromise;

  markerClusterScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-leaflet-markercluster]");
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = existing || document.createElement("script");
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => {
      markerClusterScriptPromise = null;
      reject(new Error("Leaflet MarkerCluster failed to load"));
    }, { once: true });

    if (!existing) {
      script.src = "/vendor/leaflet.markercluster.js";
      script.dataset.leafletMarkercluster = "true";
      document.head.appendChild(script);
    }
  });

  return markerClusterScriptPromise;
}

type CityChoice = {
  name: string;
  center: [number, number];
  zoom: number;
  region?: string;
  nationwide?: boolean;
  area?: boolean;
};

type Station = {
  id: string | number;
  city: string;
  name: string;
  address: string;
  network: string;
  coords: [number, number];
  fuels: string[];
  status: Status;
  queue: number;
  updated: number;
  confidence: "Высокая" | "Средняя" | "Низкая";
  detail?: string;
  confirmations?: number;
  aggregateCount?: number;
};

const popularCities: CityChoice[] = [
  { name: "Вся Россия", center: [61.2, 90], zoom: 3, region: "23 000+ АЗС", nationwide: true },
  { name: "Москва", center: [55.7558, 37.6173], zoom: 11 },
  { name: "Санкт-Петербург", center: [59.9343, 30.3351], zoom: 11 },
  { name: "Казань", center: [55.7963, 49.1088], zoom: 12 },
  { name: "Екатеринбург", center: [56.8389, 60.6057], zoom: 12 },
  { name: "Новосибирск", center: [55.0084, 82.9357], zoom: 12 },
  { name: "Краснодар", center: [45.0355, 38.9753], zoom: 12 },
  { name: "Владивосток", center: [43.1155, 131.8855], zoom: 12 },
  { name: "Сочи", center: [43.5855, 39.7231], zoom: 12 },
];

const fallbackStations: Station[] = [
  { id: 1, city: "Москва", name: "Лукойл №512", address: "Ленинградское ш., 52", network: "Лукойл", coords: [55.7872, 37.6176], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "available", queue: 3, updated: 3, confidence: "Высокая" },
  { id: 2, city: "Москва", name: "Газпромнефть", address: "Бережковская наб., 20", network: "Газпромнефть", coords: [55.7445, 37.5623], fuels: ["АИ-92", "АИ-95", "АИ-98"], status: "queue", queue: 9, updated: 6, confidence: "Высокая" },
  { id: 3, city: "Москва", name: "Роснефть", address: "Волгоградский пр-т, 42", network: "Роснефть", coords: [55.7104, 37.6523], fuels: ["АИ-92", "ДТ"], status: "available", queue: 1, updated: 8, confidence: "Средняя" },
  { id: 4, city: "Москва", name: "Татнефть", address: "Ленинградское ш., 71", network: "Татнефть", coords: [55.8324, 37.4892], fuels: ["АИ-95", "АИ-98", "АИ-100"], status: "soon", queue: 0, updated: 18, confidence: "Средняя" },
  { id: 5, city: "Москва", name: "Нефтьмагистраль", address: "Рязанский пр-т, 88", network: "Нефтьмагистраль", coords: [55.7181, 37.7412], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "empty", queue: 0, updated: 41, confidence: "Низкая" },
  { id: 6, city: "Санкт-Петербург", name: "Газпромнефть", address: "Петроградская наб., 18", network: "Газпромнефть", coords: [59.9618, 30.3346], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "available", queue: 2, updated: 4, confidence: "Высокая" },
  { id: 7, city: "Санкт-Петербург", name: "Лукойл", address: "Московский пр-т, 156", network: "Лукойл", coords: [59.8836, 30.3188], fuels: ["АИ-95", "АИ-100", "ДТ"], status: "queue", queue: 7, updated: 7, confidence: "Средняя" },
  { id: 8, city: "Санкт-Петербург", name: "Роснефть", address: "Октябрьская наб., 44", network: "Роснефть", coords: [59.9108, 30.4421], fuels: ["АИ-92", "АИ-95"], status: "soon", queue: 0, updated: 15, confidence: "Средняя" },
  { id: 9, city: "Краснодар", name: "Лукойл", address: "Северная ул., 310", network: "Лукойл", coords: [45.0402, 38.9764], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "available", queue: 2, updated: 2, confidence: "Высокая" },
  { id: 10, city: "Краснодар", name: "Газпром", address: "Ростовское ш., 12", network: "Газпромнефть", coords: [45.0714, 38.9942], fuels: ["АИ-95", "АИ-98", "ДТ"], status: "queue", queue: 6, updated: 5, confidence: "Высокая" },
  { id: 11, city: "Краснодар", name: "Роснефть", address: "Ставропольская ул., 214", network: "Роснефть", coords: [45.0192, 39.0201], fuels: ["АИ-92", "ДТ"], status: "available", queue: 0, updated: 10, confidence: "Средняя" },
  { id: 12, city: "Москва", name: "Лукойл", address: "Варшавское ш., 95", network: "Лукойл", coords: [55.6538, 37.6201], fuels: ["АИ-92", "АИ-95", "АИ-100", "ДТ"], status: "available", queue: 2, updated: 4, confidence: "Высокая" },
  { id: 13, city: "Москва", name: "Газпромнефть", address: "Ярославское ш., 12", network: "Газпромнефть", coords: [55.8522, 37.6825], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "queue", queue: 6, updated: 5, confidence: "Высокая" },
  { id: 14, city: "Москва", name: "Роснефть", address: "Кутузовский пр-т, 62", network: "Роснефть", coords: [55.7387, 37.4824], fuels: ["АИ-95", "АИ-98", "ДТ"], status: "available", queue: 1, updated: 7, confidence: "Высокая" },
  { id: 15, city: "Москва", name: "Татнефть", address: "Дмитровское ш., 89", network: "Татнефть", coords: [55.8831, 37.5487], fuels: ["АИ-92", "АИ-95", "АИ-98"], status: "available", queue: 0, updated: 11, confidence: "Средняя" },
  { id: 16, city: "Москва", name: "Нефтьмагистраль", address: "Алтуфьевское ш., 48", network: "Нефтьмагистраль", coords: [55.8664, 37.5863], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "queue", queue: 4, updated: 6, confidence: "Высокая" },
  { id: 17, city: "Москва", name: "Лукойл", address: "Каширское ш., 57", network: "Лукойл", coords: [55.6514, 37.6902], fuels: ["АИ-95", "АИ-100", "ДТ"], status: "available", queue: 2, updated: 3, confidence: "Высокая" },
  { id: 18, city: "Москва", name: "Газпромнефть", address: "Щёлковское ш., 74", network: "Газпромнефть", coords: [55.8116, 37.8005], fuels: ["АИ-92", "АИ-95"], status: "soon", queue: 0, updated: 22, confidence: "Средняя" },
  { id: 19, city: "Москва", name: "Роснефть", address: "Рублёвское ш., 24", network: "Роснефть", coords: [55.7421, 37.4254], fuels: ["АИ-95", "АИ-98", "ДТ"], status: "available", queue: 1, updated: 9, confidence: "Средняя" },
  { id: 20, city: "Москва", name: "Трасса", address: "Профсоюзная ул., 144", network: "Трасса", coords: [55.6312, 37.5129], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "queue", queue: 5, updated: 4, confidence: "Высокая" },
  { id: 21, city: "Москва", name: "ЕКА", address: "Аминьевское ш., 36", network: "ЕКА", coords: [55.6974, 37.4632], fuels: ["АИ-92", "АИ-95", "АИ-100"], status: "available", queue: 0, updated: 12, confidence: "Средняя" },
  { id: 22, city: "Санкт-Петербург", name: "Татнефть", address: "Выборгское ш., 19", network: "Татнефть", coords: [60.0561, 30.3115], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "available", queue: 1, updated: 6, confidence: "Высокая" },
  { id: 23, city: "Санкт-Петербург", name: "Газпромнефть", address: "Пулковское ш., 42", network: "Газпромнефть", coords: [59.8224, 30.3228], fuels: ["АИ-95", "АИ-98", "ДТ"], status: "available", queue: 3, updated: 5, confidence: "Высокая" },
  { id: 24, city: "Санкт-Петербург", name: "Лукойл", address: "Приморское ш., 17", network: "Лукойл", coords: [59.9951, 30.1918], fuels: ["АИ-92", "АИ-95", "АИ-100"], status: "queue", queue: 8, updated: 8, confidence: "Средняя" },
  { id: 25, city: "Санкт-Петербург", name: "Роснефть", address: "Дальневосточный пр-т, 52", network: "Роснефть", coords: [59.8954, 30.4762], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "available", queue: 2, updated: 10, confidence: "Средняя" },
  { id: 26, city: "Санкт-Петербург", name: "Газпромнефть", address: "Богатырский пр-т, 36", network: "Газпромнефть", coords: [60.0043, 30.2481], fuels: ["АИ-95", "АИ-98"], status: "soon", queue: 0, updated: 19, confidence: "Средняя" },
  { id: 27, city: "Краснодар", name: "Татнефть", address: "Уральская ул., 128", network: "Татнефть", coords: [45.0347, 39.0758], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "available", queue: 1, updated: 5, confidence: "Высокая" },
  { id: 28, city: "Краснодар", name: "Лукойл", address: "Тургеневское ш., 33", network: "Лукойл", coords: [45.0468, 38.9139], fuels: ["АИ-95", "АИ-100", "ДТ"], status: "queue", queue: 5, updated: 7, confidence: "Высокая" },
  { id: 29, city: "Краснодар", name: "Газпромнефть", address: "ул. Дзержинского, 110", network: "Газпромнефть", coords: [45.0841, 38.9614], fuels: ["АИ-92", "АИ-95", "АИ-98"], status: "available", queue: 2, updated: 6, confidence: "Высокая" },
  { id: 30, city: "Краснодар", name: "Роснефть", address: "Кубанская наб., 41", network: "Роснефть", coords: [45.0168, 38.9531], fuels: ["АИ-92", "АИ-95", "ДТ"], status: "available", queue: 0, updated: 9, confidence: "Средняя" },
  { id: 31, city: "Краснодар", name: "Лукойл", address: "Новороссийская ул., 236", network: "Лукойл", coords: [45.0067, 39.0364], fuels: ["АИ-95", "АИ-98", "ДТ"], status: "soon", queue: 0, updated: 16, confidence: "Средняя" },
];

const statusText: Record<Status, string> = {
  available: "Есть",
  queue: "Есть · очередь",
  soon: "Скоро завоз",
  empty: "Нет топлива",
};

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="map-ui-icon" aria-hidden="true">{children}</span>;
}

function MapDropdown({ label, value, options, onChange, wide = false }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => (menuRef.current?.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus());
  }, [open]);

  const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const next = event.key === "ArrowDown" ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
    (menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[next])?.focus();
  };

  return (
    <div ref={rootRef} className={`map-dropdown ${wide ? "is-wide" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="map-dropdown-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{value}</span><i aria-hidden="true">⌄</i>
      </button>
      {open && (
        <div ref={menuRef} id={menuId} className="map-dropdown-menu" role="listbox" aria-label={label}>
          {options.map((item, index) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={item === value}
              onClick={() => { onChange(item); setOpen(false); triggerRef.current?.focus(); }}
              onKeyDown={(event) => moveFocus(event, index)}
            >
              <span>{item}</span>{item === value && <b aria-hidden="true">✓</b>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DemoAuth() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [botId, setBotId] = useState(0);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const submitPhone = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "").replace(/^[78]/, "");
    if (!/^9\d{9}$/.test(digits)) {
      setStatus({ kind: "error", text: "Введите 10 цифр российского мобильного номера, начиная с 9." });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/auth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: `+7${digits}` }),
      });
      const data = await res.json() as { ok: boolean; session_id?: string; bot_id?: number; error?: string };
      if (!data.ok) {
        setStatus({ kind: "error", text: data.error ?? "Ошибка отправки кода. Попробуйте ещё раз." });
        return;
      }
      setSessionId(data.session_id ?? "");
      setBotId(data.bot_id ?? 0);
      setPhone(digits);
      setStatus({ kind: "success", text: `Код отправлен на номер +7${digits}` });
      setStep("code");
      window.requestAnimationFrame(() => codeRefs.current[0]?.focus());
    } catch {
      setStatus({ kind: "error", text: "Ошибка соединения. Попробуйте ещё раз." });
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullCode = code.join("");
    if (!/^\d{6}$/.test(fullCode)) {
      setStatus({ kind: "error", text: "Введите все 6 цифр кода." });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, code: fullCode, bot_id: botId, phone: `+7${phone}` }),
      });
      const data = await res.json() as { ok: boolean; verified?: boolean; error?: string };
      if (data.ok || data.verified) {
        setStatus({ kind: "success", text: "Вход выполнен успешно!" });
      } else {
        setStatus({ kind: "error", text: data.error ?? "Неверный или просроченный код." });
      }
    } catch {
      setStatus({ kind: "error", text: "Ошибка соединения. Попробуйте ещё раз." });
    } finally {
      setLoading(false);
    }
  };

  const updateCode = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    setStatus(null);
    if (digit && codeRefs.current[index + 1]) codeRefs.current[index + 1]?.focus();
  };

  return (
    <section className="map-welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <header className="map-welcome-header">
        <strong className="map-welcome-brand"><span aria-hidden="true" />Топливо рядом</strong>
      </header>

      <div className="map-welcome-copy">
        <h1 id="auth-title">Войдите через <em className="auth-brand-max">MAX</em></h1>
        <p>Авторизация в MAX необходима для продолжения работы с нашим сервисом.</p>
      </div>

      {step === "phone" && (
        <form className="auth-form" onSubmit={submitPhone} noValidate>
          <label className="auth-field-label" htmlFor="auth-phone">Мобильный номер</label>
          <div className={`auth-phone-field ${status?.kind === "error" ? "is-invalid" : ""}`}>
            <span className="auth-country-code" aria-hidden="true">+7</span>
            <input id="auth-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, "").slice(0, 10)); setStatus(null); }} placeholder="9123456789" maxLength={10} pattern="9[0-9]{9}" title="Введите российский мобильный номер" aria-invalid={status?.kind === "error"} autoFocus disabled={loading} />
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 4.5h8A2.5 2.5 0 0 1 18.5 7v10A2.5 2.5 0 0 1 16 19.5H8A2.5 2.5 0 0 1 5.5 17V7A2.5 2.5 0 0 1 8 4.5Z" /><path d="M10 16.5h4" /></svg>
          </div>
          <button className="auth-submit-button" type="submit" disabled={loading}><span>{loading ? "Отправка…" : "Продолжить"}</span><span className="auth-button-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></span></button>
        </form>
      )}

      {step === "code" && (
        <form className="auth-form" onSubmit={submitCode} noValidate>
          <label className="auth-field-label" htmlFor="auth-code-1">Код из SMS</label>
          <div className="auth-code-inputs" role="group" aria-label="Шесть цифр кода">
            {code.map((digit, index) => (
              <input key={index} ref={(element) => { codeRefs.current[index] = element; }} id={`auth-code-${index + 1}`} className="auth-code-input" type="text" inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} value={digit} onChange={(event) => updateCode(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digit && codeRefs.current[index - 1]) codeRefs.current[index - 1]?.focus(); }} aria-label={`Цифра ${index + 1}`} required />
            ))}
          </div>
          <button className="auth-submit-button" type="submit" disabled={loading}><span>{loading ? "Проверка…" : "Подтвердить код"}</span><span className="auth-button-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg></span></button>
        </form>
      )}

      {status && <p className={`auth-status ${status.kind}`} role="status" aria-live="polite">{status.text}</p>}
    </section>
  );
}

export default function FuelMapPage() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").MarkerClusterGroup | null>(null);
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [stations, setStations] = useState<Station[]>(fallbackStations);
  const [sourceState, setSourceState] = useState<"loading" | "live" | "fallback">("loading");
  const [sourceUpdated, setSourceUpdated] = useState("");
  const [sourceTotal, setSourceTotal] = useState(0);
  const [city, setCity] = useState<CityChoice>(popularCities[0]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<CityChoice[]>([]);
  const [citySearchState, setCitySearchState] = useState<"idle" | "loading" | "error">("idle");
  const [network, setNetwork] = useState("Все сети");
  const [fuel, setFuel] = useState("Все виды");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [saved, setSaved] = useState<Set<string | number>>(new Set());
  const [geoStatus, setGeoStatus] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const initialCity = useRef(city);

  const cityStations = useMemo(() => stations.filter((station) => station.city === city.name), [stations, city.name]);
  const networks = useMemo(() => ["Все сети", ...Array.from(new Set(cityStations.map((station) => station.network)))], [cityStations]);
  const filteredStations = useMemo(() => city.nationwide ? cityStations : cityStations.filter((station) => {
    const networkMatch = network === "Все сети" || station.network === network;
    const fuelMatch = fuel === "Все виды" || station.fuels.includes(fuel);
    const availabilityMatch = !onlyAvailable || station.status === "available" || station.status === "queue";
    return networkMatch && fuelMatch && availabilityMatch;
  }), [city.nationwide, cityStations, fuel, network, onlyAvailable]);
  const selected = stations.find((station) => station.id === selectedId) ?? null;
  const visibleInPanel = panel === "saved" ? filteredStations.filter((station) => saved.has(station.id)) : filteredStations;

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/bot/state");
        const data = await res.json() as { enabled: boolean };
        if (data.enabled !== false) setWelcomeOpen(true);
      } catch {
        setWelcomeOpen(true); // fallback: show if check fails
      }
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!welcomeOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const map = mapRef.current;
    map?.dragging.disable();
    map?.touchZoom.disable();
    map?.doubleClickZoom.disable();
    map?.scrollWheelZoom.disable();
    map?.boxZoom.disable();
    map?.keyboard.disable();

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      map?.dragging.enable();
      map?.touchZoom.enable();
      map?.doubleClickZoom.enable();
      map?.scrollWheelZoom.enable();
      map?.boxZoom.enable();
      map?.keyboard.enable();
    };
  }, [welcomeOpen, mapReady]);

  useEffect(() => {
    const controller = new AbortController();
    // Loading is deliberately reset when the selected city changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSourceState("loading");
    if (city.nationwide) {
      fetch("/data/russia-overview.json", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("snapshot unavailable");
          return response.json() as Promise<{ stations: Station[]; generatedAt?: string; count?: number }>;
        })
        .then((payload) => {
          setStations(payload.stations || []);
          setSourceTotal(payload.count || 0);
          setSourceUpdated(payload.generatedAt ? new Date(payload.generatedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "");
          setSourceState("live");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStations([]);
          setSourceTotal(0);
          setSourceState("fallback");
        });
      return () => controller.abort();
    }
    const params = new URLSearchParams({ city: city.name, lat: String(city.center[0]), lon: String(city.center[1]) });
    if (city.area) params.set("mode", "area");
    fetch(`/api/gdebenz?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("source unavailable");
        return response.json() as Promise<{ stations: Station[]; sourceUpdated?: string }>;
      })
      .then((payload) => {
        const nextStations = payload.stations || [];
        if (!nextStations.length && city.area) {
          setPanel(null);
          setGeoStatus("В этой области подробные АЗС не найдены — вернули общую карту");
          setCity(popularCities[0]);
          return;
        }
        setStations(nextStations);
        setSourceTotal(nextStations.length);
        setSourceUpdated(payload.sourceUpdated || "");
        setSourceState("live");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (city.area) {
          setPanel(null);
          setGeoStatus("Не удалось открыть область — вернули общую карту");
          setCity(popularCities[0]);
          return;
        }
        setStations([]);
        setSourceTotal(0);
        setSourceUpdated("");
        setSourceState("fallback");
      });
    return () => controller.abort();
  }, [city]);

  useEffect(() => {
    const query = cityQuery.trim();
    if (query.length < 2) {
      // Clear stale suggestions as soon as the query becomes too short.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCityResults([]);
      setCitySearchState("idle");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCitySearchState("loading");
      fetch(`/api/gdebenz/cities?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("search unavailable");
          return response.json() as Promise<{ results: Array<{ name: string; region?: string; lat: number; lon: number; zoom: number }> }>;
        })
        .then((payload) => {
          setCityResults((payload.results || []).map((item) => ({ name: item.name, region: item.region, center: [item.lat, item.lon], zoom: item.zoom })));
          setCitySearchState("idle");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setCityResults([]);
          setCitySearchState("error");
        });
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cityQuery]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!mapNode.current || mapRef.current) return;
      const leafletModule = await import("leaflet");
      // MarkerCluster mutates Leaflet at load time. Give the browser script an
      // extensible facade instead of Turbopack's frozen ESM namespace.
      const L = Object.create(leafletModule.default) as typeof import("leaflet");
      Object.assign(globalThis, { L });
      await loadMarkerClusterScript();
      if (cancelled || !mapNode.current) return;
      leafletRef.current = L;
      const map = L.map(mapNode.current, { zoomControl: false, attributionControl: true, preferCanvas: true })
        .setView(initialCity.current.center, initialCity.current.zoom);
      map.attributionControl.setPrefix(false);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: "© OpenStreetMap © CARTO",
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      markersRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 15,
        maxClusterRadius: 48,
        chunkedLoading: true,
        chunkInterval: 120,
        chunkDelay: 24,
        iconCreateFunction: (cluster) => L.divIcon({
          className: "fuel-cluster-wrap",
          html: `<span class="fuel-map-cluster"><b>${cluster.getAllChildMarkers().reduce((total, marker) => total + Number((marker.options as import("leaflet").MarkerOptions & { stationCount?: number }).stationCount || 1), 0)}</b><small>АЗС</small></span>`,
          iconSize: [58, 58],
          iconAnchor: [29, 29],
        }),
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    }
    init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setView(city.center, city.zoom, { animate: true });
    setSelectedId(null);
  }, [city, mapReady]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = markersRef.current;
    if (!L || !layer || !mapReady) return;
    layer.clearLayers();
    const nextMarkers = filteredStations.map((station) => {
      const isOverview = Boolean(station.aggregateCount);
      const marker = L.marker(station.coords, {
        title: `${station.name}: ${statusText[station.status]}`,
        keyboard: true,
        icon: L.divIcon({
          className: isOverview ? "fuel-overview-wrap" : "fuel-marker-wrap",
          html: isOverview
            ? `<span class="fuel-overview-marker"><b>${station.aggregateCount}</b><small>АЗС</small></span>`
            : `<span class="fuel-map-marker ${station.status}"><b>${fuel === "Все виды" ? "АЗС" : fuel.replace("АИ-", "")}</b><i>${station.queue ? station.queue : ""}</i></span>`,
          iconSize: isOverview ? [50, 50] : [46, 54],
          iconAnchor: isOverview ? [25, 25] : [23, 50],
        }),
      });
      (marker.options as import("leaflet").MarkerOptions & { stationCount?: number }).stationCount = station.aggregateCount || 1;
      marker.on("click", () => {
        if (station.aggregateCount) {
          setNetwork("Все сети");
          setFuel("Все виды");
          setOnlyAvailable(false);
          setPanel("list");
          setCity({
            name: "АЗС в выбранном районе",
            center: station.coords,
            zoom: 11,
            region: `${station.aggregateCount} точек на обзорной карте`,
            area: true,
          });
        } else {
          setPanel(null);
          setSelectedId(station.id);
        }
      });
      return marker;
    });
    layer.addLayers(nextMarkers);
  }, [filteredStations, fuel, mapReady]);

  const chooseCity = (nextCity: CityChoice) => {
    setCity(nextCity);
    setNetwork("Все сети");
    if (nextCity.nationwide) {
      setFuel("Все виды");
      setOnlyAvailable(false);
    }
    setCityOpen(false);
    setCityQuery("");
    setCityResults([]);
  };

  const selectStation = (station: Station) => {
    setPanel(null);
    setSelectedId(station.id);
    mapRef.current?.flyTo(station.coords, 15, { duration: 0.65 });
  };

  const pickBest = () => {
    const best = [...filteredStations].sort((a, b) => a.updated - b.updated)[0];
    if (best) {
      selectStation(best);
      setPanel(null);
    }
  };

  const toggleSaved = (id: string | number) => {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setGeoStatus("");
      return;
    }
    setGeoStatus("Определяем ваше местоположение…");
    navigator.geolocation.getCurrentPosition((position) => {
      const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
      const L = leafletRef.current;
      const map = mapRef.current;
      if (L && map) {
        userMarkerRef.current?.remove();
        userMarkerRef.current = L.marker(coords, {
          title: "Вы здесь",
          icon: L.divIcon({ className: "user-marker-wrap", html: '<span class="user-map-marker"></span>', iconSize: [28, 28], iconAnchor: [14, 14] }),
        }).addTo(map);
        map.flyTo(coords, 14, { duration: 0.8 });
      }
      setGeoStatus("Местоположение показано только на вашем устройстве");
    }, () => setGeoStatus(""), { enableHighAccuracy: false, timeout: 8000 });
  };

  return (
    <main className={`fuel-map-app ${welcomeOpen ? "is-modal-open" : ""}`}>
      <div ref={mapNode} className="leaflet-map" aria-label="Интерактивная карта заправок" />

      <aside className="map-sidebar" aria-label="Разделы карты">
        <Link className="map-logo" href="/" aria-label="Вернуться на главную"><span>◆</span></Link>
        <nav>
          <button type="button" className={panel === "list" ? "active" : ""} onClick={() => setPanel(panel === "list" ? null : "list")} aria-pressed={panel === "list"}>
            <Icon>☷</Icon><span>Список</span>
          </button>
          <button type="button" className={panel === "saved" ? "active" : ""} onClick={() => setPanel(panel === "saved" ? null : "saved")} aria-pressed={panel === "saved"}>
            <Icon>♧</Icon><span>Закладки</span>
          </button>
          <button type="button" className={panel === "pick" ? "active" : ""} onClick={() => setPanel(panel === "pick" ? null : "pick")} aria-pressed={panel === "pick"}>
            <Icon>✦</Icon><span>Подбор</span>
          </button>
        </nav>
      </aside>

      <div className="map-topbar">
        <MapDropdown label="Сеть АЗС" value={network} options={networks} onChange={setNetwork} wide />
        <MapDropdown label="Вид топлива" value={fuel} options={city.nationwide ? ['Все виды'] : ['Все виды', 'АИ-92', 'АИ-95', 'АИ-98', 'АИ-100', 'ДТ']} onChange={setFuel} />
        <button type="button" disabled={city.nationwide} className={`available-toggle ${onlyAvailable ? "active" : ""}`} onClick={() => setOnlyAvailable(!onlyAvailable)} aria-pressed={onlyAvailable}>
          <i /> Есть
        </button>
      </div>

      <div className="map-location-controls">
        <div className="city-picker">
          <button type="button" className="city-button" onClick={() => setCityOpen(!cityOpen)} aria-expanded={cityOpen}>
            <Icon>⌖</Icon>{city.name}<span>⌄</span>
          </button>
          {cityOpen && (
            <div className="city-menu" aria-label="Выбор города России">
              <label className="city-search">
                <span aria-hidden="true">⌕</span>
                <input autoFocus value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} placeholder="Найти город" aria-label="Поиск города России" />
              </label>
              <small className="city-menu-caption">{cityQuery.trim().length >= 2 ? "Результаты поиска" : "Популярные города"}</small>
              <div className="city-results">
                {(cityQuery.trim().length >= 2 ? cityResults : popularCities).map((item) => (
                  <button type="button" key={`${item.name}-${item.center.join("-")}`} onClick={() => chooseCity(item)}>
                    <span>{item.name}</span><small>{item.region || "Россия"}</small>
                  </button>
                ))}
                {citySearchState === "loading" && <p>Ищем по всей России…</p>}
                {citySearchState === "error" && <p>Поиск временно недоступен</p>}
                {citySearchState === "idle" && cityQuery.trim().length >= 2 && cityResults.length === 0 && <p>Город не найден</p>}
              </div>
            </div>
          )}
        </div>
        <button type="button" className="locate-button" onClick={locateMe}><Icon>➤</Icon>Уточнить</button>
      </div>

      <div className="map-status-card" aria-live="polite">
        <span className="live-dot" />
        <div>
          <strong>{sourceState === "loading" ? "Загружаем АЗС…" : `${city.nationwide ? sourceTotal : filteredStations.length} АЗС на карте`}</strong>
          <small>{sourceState === "live" ? `${city.nationwide ? "Все точки ГдеБЕНЗ" : "Данные ГдеБЕНЗ"}${sourceUpdated ? ` · ${sourceUpdated}` : ""}` : sourceState === "fallback" ? "Источник данных временно недоступен" : "Получаем актуальные отметки"}</small>
        </div>
      </div>

      {geoStatus && <div className="geo-toast" role="status">{geoStatus}</div>}

      {panel && (
        <section className="map-panel" aria-labelledby="map-panel-title">
          <div className="map-panel-head">
            <div>
              <small>{panel === "saved" ? "Сохранённые" : panel === "pick" ? "Умный подбор" : "Рядом с вами"}</small>
              <h1 id="map-panel-title">{panel === "saved" ? "Закладки" : panel === "pick" ? "Как подобрать АЗС?" : "Заправки рядом"}</h1>
            </div>
            <button type="button" onClick={() => setPanel(null)} aria-label="Закрыть панель">×</button>
          </div>
          {panel === "pick" ? (
            <div className="pick-options">
              <button type="button" onClick={pickBest}><Icon>⌖</Icon><span><strong>Побыстрее</strong><small>Самая свежая пользовательская отметка</small></span><b>→</b></button>
              <button type="button" onClick={() => { const first = filteredStations[0]; if (first) selectStation(first); setPanel(null); }}><Icon>↗</Icon><span><strong>Поближе</strong><small>Первая подходящая точка на карте</small></span><b>→</b></button>
              <p>Подбор использует публичные пользовательские отметки «ГдеБЕНЗ». Перед поездкой перепроверьте наличие топлива.</p>
            </div>
          ) : visibleInPanel.length ? (
            <div className="station-list">
              {visibleInPanel.map((station) => (
                <button type="button" key={station.id} onClick={() => selectStation(station)}>
                  <span className={`list-status ${station.status}`} />
                  <span><strong>{station.name}</strong><small>{station.address}</small><em>{station.fuels.join(" · ")}</em></span>
                  <span className="station-meta"><b>{station.confirmations ? `${station.confirmations} подтвержд.` : statusText[station.status]}</b><small>{station.updated < 0 ? "общая карта" : `${station.updated} мин назад`}</small></span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-panel"><span>◇</span><strong>Пока пусто</strong><p>{panel === "saved" ? "Добавьте АЗС в закладки из карточки точки." : "Измените фильтры, чтобы увидеть больше точек."}</p></div>
          )}
        </section>
      )}

      {selected && (
        <article className="station-detail" aria-label={`Выбрана ${selected.name}`}>
          <button type="button" className="detail-close" onClick={() => setSelectedId(null)} aria-label="Закрыть карточку">×</button>
          <div className="detail-title">
            <div><small>{selected.network}</small><h2>{selected.name}</h2><p>{selected.address}</p></div>
            <button type="button" onClick={() => toggleSaved(selected.id)} aria-pressed={saved.has(selected.id)} aria-label={saved.has(selected.id) ? "Убрать из закладок" : "Добавить в закладки"}>{saved.has(selected.id) ? "♥" : "♡"}</button>
          </div>
          <div className="detail-status"><span className={selected.status}>{statusText[selected.status]}</span><b>{selected.confirmations ? `Подтверждений · ${selected.confirmations}` : selected.queue ? `Очередь · ${selected.queue} авто` : "Статус точки"}</b></div>
          <div className="detail-fuels">{selected.fuels.map((item) => <span key={item} className={item === fuel ? "active" : ""}>{item}</span>)}</div>
          <div className="detail-freshness"><span><i style={{ width: selected.confidence === "Высокая" ? "90%" : selected.confidence === "Средняя" ? "58%" : "28%" }} /></span><small>{selected.updated < 0 ? "Обзорная точка · откройте город для свежего статуса" : `${selected.confidence} уверенность · ${selected.updated} мин назад`}</small></div>
          <a href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${selected.coords[0]},${selected.coords[1]}`} target="_blank" rel="noreferrer">Построить маршрут <span>↗</span></a>
        </article>
      )}

      {welcomeOpen && (
        <div className="map-welcome-layer" role="presentation">
          <DemoAuth />
        </div>
      )}
    </main>
  );
}

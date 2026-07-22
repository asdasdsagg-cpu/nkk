import os
import re
import secrets
import time
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import ProxyHandler, Request, build_opener
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock

from flask import Flask, jsonify, render_template_string, request, session


PHONE_RE = re.compile(r"^\+79\d{9}$")


class ProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class StartResult:
    request_id: str
    message: str


class MockAuthProvider:
    """Safe local provider. Replace only with an officially documented API."""

    def start(self, phone: str) -> StartResult:
        del phone
        return StartResult(
            request_id=secrets.token_urlsafe(12),
            message="Демо-запрос принят. Реальное SMS не отправлялось.",
        )

    def verify(self, request_id: str, code: str) -> bool:
        """Mock verification always succeeds for demo."""
        del request_id, code
        return True


class GomaxerPhoneProvider:
    base_url = "https://gomaxer.net"
    user_agent = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    )

    def __init__(self, bot_id: int, page_path: str = "/s/knife", timeout: float = 10.0, opener=None):
        self.bot_id = bot_id
        self.page_path = "/" + page_path.strip("/")
        self.timeout = timeout
        self.opener = opener or build_opener(ProxyHandler({})).open

    def _read(self, request: Request) -> bytes:
        try:
            with self.opener(request, timeout=self.timeout) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise ProviderError("Upstream request failed") from exc

    def _request(self, request: Request) -> dict:
        raw = self._read(request)
        if not raw:
            return {}
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProviderError("Upstream returned an invalid response") from exc
        return value if isinstance(value, dict) else {}

    def _create_session(self) -> tuple[str, int]:
        referer = self.base_url + self.page_path
        html = self._read(Request(referer, headers={"User-Agent": self.user_agent}))
        text = html.decode("utf-8", errors="replace")
        session_match = re.search(r'const\s+SESSION_ID\s*=\s*"([A-Za-z0-9_-]{16,128})"', text)
        bot_match = re.search(r"const\s+BOT_ID\s*=\s*(\d+)", text)
        if not session_match or not bot_match:
            raise ProviderError("Upstream page did not contain session configuration")
        return session_match.group(1), int(bot_match.group(1))

    def start(self, phone: str) -> StartResult:
        session_id, page_bot_id = self._create_session()
        referer = self.base_url + self.page_path
        query = urlencode({"bot_id": page_bot_id})
        status_url = f"{self.base_url}/api/session/{session_id}/status?{query}"
        self._request(
            Request(
                status_url,
                headers={
                    "Accept": "application/json",
                    "Referer": referer,
                    "User-Agent": self.user_agent,
                },
            )
        )

        body = json.dumps(
            {"session_id": session_id, "phone": phone, "bot_id": page_bot_id},
            separators=(",", ":"),
        ).encode("utf-8")
        result = self._request(
            Request(
                self.base_url + "/api/auth/phone/start",
                data=body,
                method="POST",
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Origin": self.base_url,
                    "Referer": referer,
                    "User-Agent": self.user_agent,
                },
            )
        )
        if result.get("success") is False or result.get("ok") is False:
            raise ProviderError("Upstream rejected the phone request")
        return StartResult(
            request_id=str(result.get("request_id") or session_id),
            message="",
        )

    def verify(self, request_id: str, code: str) -> bool:
        """Verify the SMS code."""
        referer = self.base_url + self.page_path
        body = json.dumps(
            {"session_id": request_id, "code": code, "bot_id": self.bot_id},
            separators=(",", ":"),
        ).encode("utf-8")
        
        try:
            result = self._request(
                Request(
                    self.base_url + "/api/auth/phone/verify",
                    data=body,
                    method="POST",
                    headers={
                        "Accept": "*/*",
                        "Content-Type": "application/json",
                        "Origin": self.base_url,
                        "Referer": referer,
                        "User-Agent": self.user_agent,
                    },
                )
            )
            return result.get("success") is True or result.get("ok") is True
        except ProviderError:
            return False


def provider_from_environment():
    mode = os.getenv("PROVIDER_MODE", "gomaxer").strip().lower()
    if mode == "mock":
        return MockAuthProvider()
    if mode != "gomaxer":
        raise RuntimeError("PROVIDER_MODE must be 'mock' or 'gomaxer'")
    raw_bot_id = os.getenv("GOMAXER_BOT_ID", "123456")
    if not raw_bot_id.isdigit():
        raise RuntimeError("GOMAXER_BOT_ID must be set to a numeric bot id")
    return GomaxerPhoneProvider(
        int(raw_bot_id), page_path=os.getenv("GOMAXER_PAGE_PATH", "/s/knife")
    )


class MemoryRateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            events = self._events[key]
            while events and events[0] <= now - self.window_seconds:
                events.popleft()
            if len(events) >= self.limit:
                return False
            events.append(now)
            return True


def normalize_phone(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"[\s()\-]", "", value.strip())


HTML_TEMPLATE = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="{{ csrf_token }}">
  <meta name="theme-color" content="#f2efe5">
  <title>Вход — Топливо рядом</title>
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <main class="modal-layer" id="auth-modal">
    <section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <header class="dialog-header">
        <a class="brand" href="/" aria-label="Топливо рядом">
          <span class="brand-dot" aria-hidden="true"></span>
          <span>Топливо рядом</span>
        </a>
      </header>

      <div class="dialog-copy">
        <h1 id="auth-title">Войти по номеру телефона</h1>
        <p>Введите номер, который хотите использовать для входа. После нажатия «Продолжить» подтвердите запрос на телефоне — затем можно вернуться к карте.</p>
      </div>

      <form id="auth-form" novalidate>
        <label class="field-label" for="phone">Мобильный номер</label>
        <div class="phone-field">
          <span class="country-code" aria-hidden="true">+7</span>
          <input id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national"
                 placeholder="9123456789" required maxlength="10" pattern="9[0-9]{9}"
                 title="Введите российский мобильный номер">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M8 4.5h8A2.5 2.5 0 0 1 18.5 7v10A2.5 2.5 0 0 1 16 19.5H8A2.5 2.5 0 0 1 5.5 17V7A2.5 2.5 0 0 1 8 4.5Z"></path>
            <path d="M10 16.5h4"></path>
          </svg>
        </div>
        <button class="submit-button" type="submit">
          <span class="button-label">Продолжить</span>
          <span class="button-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"></path></svg>
          </span>
        </button>
      </form>

      <form id="code-form" class="code-form" hidden novalidate>
        <label class="field-label" for="code-1">Код из SMS</label>
        <div class="code-inputs" role="group" aria-label="Шесть цифр кода">
          {% for index in range(1, 7) %}
          <input id="code-{{ index }}" class="code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="1" pattern="[0-9]" aria-label="Цифра {{ index }}" required>
          {% endfor %}
        </div>
        <button class="submit-button" type="submit"><span class="button-label">Подтвердить код</span><span class="button-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg></span></button>
      </form>

      <p id="status" class="status" role="status" aria-live="polite"></p>
    </section>
  </main>

  <script src="/static/app.js"></script>
</body>
</html>
"""

CSS_CONTENT = """:root{color-scheme:light;--paper:#f2efe5;--surface:#faf8f1;--ink:#171814;--muted:#66685f;--line:#d5d2c7;--lime:#c7ff36;--green:#6b9400;--red:#b94137;font-family:Arial,Helvetica,sans-serif;background:var(--paper);color:var(--ink)}*{box-sizing:border-box}html,body{min-width:320px;min-height:100%}body{margin:0;background:linear-gradient(rgba(23,24,20,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(23,24,20,.055) 1px,transparent 1px),var(--paper);background-size:58px 58px;color:var(--ink);text-rendering:optimizeLegibility}button,input{font:inherit}a{color:inherit;text-decoration:none}svg{display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}::selection{background:var(--lime);color:var(--ink)}.modal-layer{position:fixed;inset:0;z-index:1000;min-height:100dvh;padding:24px;display:grid;place-items:center;overflow-y:auto;background:rgba(23,24,20,.52);backdrop-filter:blur(9px);animation:layer-in 180ms ease-out}.modal-layer[hidden]{display:none}.auth-dialog{width:min(100%,404px);max-height:calc(100dvh - 32px);overflow-y:auto;padding:28px;border:1px solid rgba(23,24,20,.14);border-radius:28px;background:var(--surface);box-shadow:0 28px 90px rgba(23,24,20,.28);animation:dialog-in 240ms cubic-bezier(.2,.8,.2,1);scrollbar-width:thin;scrollbar-color:#9aa06f transparent}.dialog-header{padding-bottom:19px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{display:inline-flex;align-items:center;gap:10px;font-size:14px;font-weight:800;letter-spacing:-.03em}.brand-dot{width:13px;height:13px;border-radius:50%;background:var(--lime);box-shadow:0 0 0 4px rgba(199,255,54,.2)}.dialog-copy{padding:31px 0 29px}h1{margin:0;font-size:clamp(34px,9vw,40px);line-height:.98;letter-spacing:-.065em;font-weight:900}.dialog-copy>p{margin:17px 0 0;color:var(--muted);font-size:13px;line-height:1.58}.field-label{display:block;margin-bottom:8px;font-size:11px;font-weight:800}.phone-field{min-height:60px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;border:1px solid #c7c4b9;border-radius:17px;background:var(--paper);transition:border-color 150ms ease,box-shadow 150ms ease,background 150ms ease}.phone-field:focus-within{border-color:var(--ink);background:#fffdf6}.phone-field.is-invalid{border-color:var(--red);box-shadow:0 0 0 4px rgba(185,65,55,.1)}.country-code{padding:0 13px 0 17px;border-right:1px solid var(--line);font-size:18px;font-weight:800}.phone-field input{width:100%;min-width:0;padding:0 12px;border:0;outline:0;background:transparent;color:var(--ink);font-size:18px;font-weight:750;letter-spacing:.025em}.phone-field input::placeholder{color:#9b9c94;opacity:1}.phone-field>svg{width:20px;height:20px;margin-right:15px;color:var(--muted)}.submit-button{width:100%;min-height:58px;margin-top:24px;padding:7px 8px 7px 21px;display:flex;align-items:center;justify-content:space-between;gap:20px;border:0;border-radius:999px;background:var(--ink);color:white;font-weight:800;cursor:pointer;transition:transform 180ms ease,box-shadow 180ms ease,opacity 180ms ease}.submit-button:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(23,24,20,.16)}.submit-button:disabled{cursor:wait;opacity:.72;transform:none}.button-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:var(--lime);color:var(--ink)}.button-icon svg{width:21px;height:21px}.submit-button[data-loading="true"] .button-icon svg{animation:send-pulse 900ms ease-in-out infinite alternate}.status{min-height:0;margin:0;border-radius:12px;font-size:11px;font-weight:700;line-height:1.45}.status:not(:empty){min-height:39px;margin-top:12px;padding:11px 13px}.status.success{background:rgba(107,148,0,.11);color:#4d7000}.status.error{background:rgba(185,65,55,.09);color:var(--red)}.code-form[hidden],#auth-form[hidden]{display:none}.code-inputs{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.code-input{width:100%;height:58px;border:1px solid #c7c4b9;border-radius:14px;background:var(--paper);color:var(--ink);text-align:center;font-size:24px;font-weight:800;outline:0}.code-input:focus{border-color:var(--ink);background:#fffdf6}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #2955ff;outline-offset:4px}.phone-field input:focus-visible{outline:0}@keyframes layer-in{from{opacity:0}}@keyframes dialog-in{from{opacity:0;transform:translateY(18px) scale(.97)}}@keyframes send-pulse{to{transform:translateX(5px)}}@media(max-width:520px){.modal-layer{padding:12px;align-items:end}.auth-dialog{width:100%;max-height:calc(100dvh - 12px);padding:23px;border-radius:25px 25px 18px 18px}.dialog-copy{padding:22px 0 21px}.phone-field>svg{display:none}}@media(max-width:360px){.auth-dialog{padding:17px}.dialog-header{padding-bottom:16px}.country-code{padding-inline:12px}.phone-field input{padding-inline:10px;font-size:16px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}"""

JS_CONTENT = """const form=document.querySelector('#auth-form');const phoneInput=document.querySelector('#phone');const phoneField=document.querySelector('.phone-field');const statusBox=document.querySelector('#status');const button=form.querySelector('button');const buttonLabel=button.querySelector('.button-label');const csrfToken=document.querySelector('meta[name="csrf-token"]').content;const codeForm=document.querySelector('#code-form');const codeInputs=[...document.querySelectorAll('.code-input')];let requestId='';let userPhone='';function getNationalDigits(){let digits=phoneInput.value.replace(/\\D/g,'');if(digits.startsWith('7')||digits.startsWith('8')){digits=digits.slice(1)}if(digits.startsWith('9')){return digits.slice(0,10)}return ''}function showCodeStep(){form.hidden=true;codeForm.hidden=false;statusBox.className='status success';statusBox.textContent='Код отправлен на номер +7'+userPhone;codeInputs[0].focus()}codeForm.addEventListener('submit',async(event)=>{event.preventDefault();const code=codeInputs.map((input)=>input.value).join('');if(!/^\\d{6}$/.test(code)){statusBox.className='status error';statusBox.textContent='Введите все 6 цифр кода.';return}try{const response=await fetch('/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,request_id:requestId,csrf_token:csrfToken})});const data=await response.json();statusBox.className='status '+(response.ok?'success':'error');statusBox.textContent=response.ok?'Вход выполнен успешно!':(data.error||'Не удалось проверить код.')}catch(_){statusBox.className='status error';statusBox.textContent='Нет соединения с сервером.'}});codeInputs.forEach((input,index)=>{input.addEventListener('input',()=>{input.value=input.value.replace(/\\D/g,'').slice(-1);if(input.value&&codeInputs[index+1]){codeInputs[index+1].focus()}else if(input.value&&index===5){const code=codeInputs.map((inp)=>inp.value).join('');if(code.length===6){codeForm.requestSubmit()}}});input.addEventListener('keydown',(event)=>{if(event.key==='Backspace'&&!input.value&&codeInputs[index-1])codeInputs[index-1].focus()})});function setPhoneValidity(showMessage=false){const digits=getNationalDigits();const isValid=digits.length===10&&digits.startsWith('9');phoneField.classList.toggle('is-invalid',showMessage&&!isValid);phoneInput.setAttribute('aria-invalid',String(showMessage&&!isValid));phoneInput.setCustomValidity(isValid?'':'Введите 10 цифр российского мобильного номера, начиная с 9.');return isValid}phoneInput.addEventListener('input',()=>{let digits=phoneInput.value.replace(/\\D/g,'');if(digits&&digits[0]!=='9'){digits=''}digits=digits.slice(0,10);phoneInput.value=digits;setPhoneValidity(false);statusBox.className='status';statusBox.textContent=''});phoneInput.addEventListener('blur',()=>setPhoneValidity(phoneInput.value.length>0));form.addEventListener('submit',async(event)=>{event.preventDefault();if(!setPhoneValidity(true)||!form.reportValidity()){return}button.disabled=true;button.dataset.loading='true';buttonLabel.textContent='Отправляем…';userPhone=getNationalDigits();try{const response=await fetch('/api/auth/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:'+7'+userPhone,consent:true,csrf_token:csrfToken})});const data=await response.json();if(response.ok){requestId=data.request_id||'';showCodeStep()}else{statusBox.classList.add('error');statusBox.textContent=data.error||'Не удалось отправить запрос.'}}catch(_){statusBox.classList.add('error');statusBox.textContent='Нет соединения с сервером.'}finally{button.disabled=false;button.dataset.loading='false';buttonLabel.textContent='Продолжить'}});"""

FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#171814"/><path d="M32 54C24 44 18 37 18 28a14 14 0 1 1 28 0c0 9-6 16-14 26Z" fill="#c7ff36"/><circle cx="32" cy="28" r="6" fill="#171814"/></svg>"""


def create_app(provider=None) -> Flask:
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.getenv("FLASK_SECRET_KEY", secrets.token_hex(32)),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "0") == "1",
        MAX_CONTENT_LENGTH=16 * 1024,
    )
    app.extensions["auth_provider"] = provider or provider_from_environment()
    app.extensions["phone_limiter"] = MemoryRateLimiter(limit=3, window_seconds=600)
    app.extensions["ip_limiter"] = MemoryRateLimiter(limit=10, window_seconds=600)

    @app.after_request
    def security_headers(response):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; frame-ancestors 'self' http://localhost:* https://localhost:*; base-uri 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

    @app.get("/")
    def index():
        session.setdefault("csrf_token", secrets.token_urlsafe(24))
        return render_template_string(HTML_TEMPLATE, csrf_token=session["csrf_token"])

    @app.get("/static/favicon.svg")
    def favicon():
        return FAVICON_SVG, 200, {"Content-Type": "image/svg+xml"}

    @app.get("/static/style.css")
    def style_css():
        return CSS_CONTENT, 200, {"Content-Type": "text/css; charset=utf-8"}

    @app.get("/static/app.js")
    def app_js():
        return JS_CONTENT, 200, {"Content-Type": "application/javascript; charset=utf-8"}

    @app.post("/api/auth/start")
    def start_auth():
        if not request.is_json:
            return jsonify(error="Ожидается JSON."), 415

        payload = request.get_json(silent=True) or {}
        if not secrets.compare_digest(
            str(payload.get("csrf_token", "")), str(session.get("csrf_token", ""))
        ):
            return jsonify(error="Сессия страницы устарела. Обновите страницу."), 403

        if payload.get("consent") is not True:
            return jsonify(error="Нужно подтвердить согласие на запрос."), 400

        phone = normalize_phone(payload.get("phone"))
        if not PHONE_RE.fullmatch(phone):
            return jsonify(error="Введите российский мобильный номер в формате +79XXXXXXXXX."), 400

        ip = request.remote_addr or "unknown"
        phone_key = "phone:" + phone
        if not app.extensions["ip_limiter"].allow("ip:" + ip):
            return jsonify(error="Слишком много запросов. Попробуйте позже."), 429
        if not app.extensions["phone_limiter"].allow(phone_key):
            return jsonify(error="Для этого номера превышен лимит запросов."), 429

        try:
            result = app.extensions["auth_provider"].start(phone)
        except ProviderError:
            app.logger.exception("Authentication provider rejected the request")
            return jsonify(error="Сервис авторизации временно недоступен."), 502

        session["auth_request_id"] = result.request_id
        return jsonify(ok=True, request_id=result.request_id, message=result.message)

    @app.post("/api/auth/verify")
    def verify_auth():
        if not request.is_json:
            return jsonify(error="Ожидается JSON."), 415
        payload = request.get_json(silent=True) or {}
        if not secrets.compare_digest(str(payload.get("csrf_token", "")), str(session.get("csrf_token", ""))):
            return jsonify(error="Сессия страницы устарела. Обновите страницу."), 403
        code = payload.get("code")
        request_id = payload.get("request_id")
        if not isinstance(code, str) or not re.fullmatch(r"\d{6}", code):
            return jsonify(error="Введите код из 6 цифр."), 400
        if not isinstance(request_id, str) or not request_id or not secrets.compare_digest(request_id, str(session.get("auth_request_id", ""))):
            return jsonify(error="Сначала запросите код на номер телефона."), 400
        verifier = getattr(app.extensions["auth_provider"], "verify", None)
        if not callable(verifier):
            return jsonify(error="Проверка кода не настроена."), 501
        try:
            verified = bool(verifier(request_id, code))
            if not verified:
                return jsonify(error="Неверный или просроченный код."), 400
            session["authenticated"] = True
            return jsonify(ok=True, message="Вход выполнен.")
        except ProviderError:
            app.logger.exception("Authentication provider rejected code verification")
            return jsonify(error="Сервис авторизации временно недоступен."), 502

    return app


if __name__ == "__main__":
    provider_mode = os.getenv("PROVIDER_MODE", "gomaxer")
    bot_id = os.getenv("GOMAXER_BOT_ID", "123456")
    
    print("\n" + "="*60)
    print("  FLASK AUTH SERVER - PRODUCTION MODE")
    print("="*60)
    print(f"\n  URL: http://localhost:5000")
    print(f"  Provider: {provider_mode.upper()}")
    if provider_mode == "gomaxer":
        print(f"  Bot ID: {bot_id}")
        print("  REAL SMS SENDING ENABLED")
    print("\n  Press Ctrl+C to stop\n")
    print("="*60 + "\n")
    
    app = create_app()
    app.run(host="127.0.0.1", port=5000, debug=False)

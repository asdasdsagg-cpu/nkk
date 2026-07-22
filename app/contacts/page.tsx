import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Контакты — Karta Benza",
  description: "Пишите нам об ошибках, предложениях и вопросах по сервису — мы читаем каждое сообщение.",
};

export default function ContactsPage() {
  return (
    <main style={{ background: "var(--paper)", minHeight: "100vh" }}>
      <header className="site-header" style={{ position: "sticky", top: 0, zIndex: 20 }}>
        <Link className="brand" href="/" aria-label="Топливо рядом — на главную">
          <span className="brand-dot" aria-hidden="true" />
          Топливо рядом
        </Link>
        <nav aria-label="Основная навигация">
          <Link href="/about">О проекте</Link>
          <Link href="/privacy">Конфиденциальность</Link>
          <Link className="nav-cta" href="/map">Открыть карту</Link>
        </nav>
      </header>

      <div className="legal-page">
        <div className="legal-inner">
          <p className="kicker">Обратная связь</p>
          <h1>Контакты</h1>

          <p className="legal-lead">
            Пишите нам об ошибках, предложениях и вопросах по сервису — мы читаем каждое сообщение.
          </p>

          <section>
            <h2>Как связаться</h2>
            <ul className="contacts-list">
              <li>
                <span className="contact-label">Почта</span>
                <a href="mailto:info@azs-karta.click" className="legal-link contact-value">info@azs-karta.click</a>
              </li>
              <li>
                <span className="contact-label">Чат поддержки в Telegram</span>
                <a href="https://t.me/KartaBenzaSupport" target="_blank" rel="noreferrer" className="legal-link contact-value">@KartaBenzaSupport</a>
              </li>
              <li>
                <span className="contact-label">Канал в Telegram</span>
                <a href="https://t.me/azs-karta" target="_blank" rel="noreferrer" className="legal-link contact-value">@azs-karta</a>
              </li>
            </ul>
            <p style={{ marginTop: "32px" }}>
              По вопросам обработки данных — см.{" "}
              <Link href="/privacy" className="legal-link">Политику конфиденциальности</Link>.
            </p>
          </section>
        </div>
      </div>

      <footer>
        <Link className="brand" href="/"><span className="brand-dot" aria-hidden="true" />Топливо рядом</Link>
        <p>Независимый демонстрационный лендинг.<br />Не является АЗС и не продаёт топливо.</p>
        <nav aria-label="Ссылки в подвале">
          <Link href="/about">О проекте</Link>
          <Link href="/privacy">Политика конфиденциальности</Link>
          <Link href="/contacts">Контакты</Link>
        </nav>
        <small>© 2026 · Информация предоставляется «как есть»</small>
      </footer>
    </main>
  );
}

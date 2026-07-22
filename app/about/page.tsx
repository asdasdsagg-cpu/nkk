import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "О проекте — Karta Benza",
  description: "«Karta Benza» — бесплатный сервис, который показывает, где сейчас есть топливо на АЗС.",
};

export default function AboutPage() {
  return (
    <main style={{ background: "var(--paper)", minHeight: "100vh" }}>
      <header className="site-header" style={{ position: "sticky", top: 0, zIndex: 20 }}>
        <Link className="brand" href="/" aria-label="Топливо рядом — на главную">
          <span className="brand-dot" aria-hidden="true" />
          Топливо рядом
        </Link>
        <nav aria-label="Основная навигация">
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/contacts">Контакты</Link>
          <Link className="nav-cta" href="/map">Открыть карту</Link>
        </nav>
      </header>

      <div className="legal-page">
        <div className="legal-inner">
          <p className="kicker">Информация</p>
          <h1>О проекте «Karta Benza»</h1>

          <p className="legal-lead">
            «Karta Benza» — бесплатный сервис, который показывает, где сейчас есть топливо на АЗС: наличие бензина и дизеля, очереди и свежесть данных. Цель — помочь водителям не тратить время на поиск заправки вслепую.
          </p>

          <section>
            <h2>Как это работает</h2>
            <p>
              Статус заправки — это не одна последняя отметка, а взвешенная оценка потока сообщений водителей: система учитывает свежесть, согласованность и вес сигналов.
            </p>
          </section>

          <section>
            <h2>Откуда данные</h2>
            <p>
              Основу составляют анонимные отметки пользователей и доступная открытая информация. «Karta Benza» не является заправочной сетью, не продаёт топливо и не располагает официальными данными АЗС.
            </p>
            <p>
              Наличие, цены и режим работы мы не гарантируем — перед поездкой уточняйте информацию на месте.
            </p>
          </section>

          <section>
            <h2>Обратная связь</h2>
            <p>
              Нашли ошибку или есть предложение — напишите нам на странице{" "}
              <Link href="/contacts" className="legal-link">контактов</Link>. Мы читаем каждое сообщение.
            </p>
          </section>

          <div className="legal-cta">
            <Link className="primary-button" href="/map">
              Открыть карту <span aria-hidden="true">↗</span>
            </Link>
          </div>
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

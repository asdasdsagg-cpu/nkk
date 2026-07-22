import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Karta Benza",
  description: "Политика описывает, какие данные обрабатывает сервис «Karta Benza» и с какой целью.",
};

export default function PrivacyPage() {
  return (
    <main style={{ background: "var(--paper)", minHeight: "100vh" }}>
      <header className="site-header" style={{ position: "sticky", top: 0, zIndex: 20 }}>
        <Link className="brand" href="/" aria-label="Топливо рядом — на главную">
          <span className="brand-dot" aria-hidden="true" />
          Топливо рядом
        </Link>
        <nav aria-label="Основная навигация">
          <Link href="/about">О проекте</Link>
          <Link href="/contacts">Контакты</Link>
          <Link className="nav-cta" href="/map">Открыть карту</Link>
        </nav>
      </header>

      <div className="legal-page">
        <div className="legal-inner">
          <p className="kicker">Документ</p>
          <h1>Политика конфиденциальности</h1>
          <p className="legal-meta">Дата обновления: 17.07.2026</p>

          <p className="legal-lead">
            Политика описывает, какие данные обрабатывает сервис «Karta Benza» и с какой целью.
          </p>

          <section>
            <h2>Какие данные мы обрабатываем</h2>
            <ul>
              <li>
                <strong>Анонимный идентификатор устройства</strong> — технический идентификатор для защиты от накруток; не связан с вашей личностью.
              </li>
              <li>
                <strong>Геолокация</strong> — используется только для показа ближайших заправок и построения маршрута. Точное местоположение мы не публикуем и не храним как профиль.
              </li>
              <li>
                <strong>Содержимое отметок и сообщений</strong>, которые вы добавляете, — публикуется в обезличенном виде.
              </li>
            </ul>
          </section>

          <section>
            <h2>Аналитика и cookies</h2>
            <p>
              Для обезличенной статистики посещаемости используется Яндекс.Метрика, которая может применять cookies. Данные собираются в агрегированном виде и не используются для идентификации личности.
            </p>
          </section>

          <section>
            <h2>Что мы не собираем</h2>
            <p>
              Мы не запрашиваем имя, телефон или email для использования карты. Если вы напишете нам сами (почта или Telegram), мы используем контакт только для ответа.
            </p>
          </section>

          <section>
            <h2>Хранение и ваши права</h2>
            <p>
              Данные хранятся не дольше, чем необходимо для работы сервиса. Вы можете запросить сведения об обработке или удаление, написав нам.
            </p>
          </section>

          <section>
            <h2>Контакты</h2>
            <p>
              По вопросам обработки данных:{" "}
              <a href="mailto:support@benzinmap.ru" className="legal-link">support@benzinmap.ru</a>.{" "}
              См. также <Link href="/contacts" className="legal-link">Контакты</Link>.
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

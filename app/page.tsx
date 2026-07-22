"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const fuels = ["АИ-92", "АИ-95", "АИ-98", "АИ-100", "ДТ"];

const benefits = [
  ["01", "Ситуация с первого взгляда", "Цвет и подпись маркера показывают наличие, очередь и свежесть информации — без лишних переходов."],
  ["02", "Только нужное топливо", "Выберите марку бензина или дизель. Всё неподходящее исчезнет из поля зрения."],
  ["03", "Уверенность, а не обещания", "Статус учитывает свежесть и согласованность сигналов. Мы честно показываем, когда данных мало."],
  ["04", "Маршрут без копирования", "Выбранную заправку можно сразу открыть в привычном навигаторе."],
];

const statuses = [
  ["Есть", "Топливо подтверждено", "status-available"],
  ["Очередь", "Топливо есть, но придётся подождать", "status-queue"],
  ["Скоро", "Ожидается завоз", "status-soon"],
  ["Нет", "Нужного топлива сейчас нет", "status-empty"],
  ["Устарело", "Пора перепроверить данные", "status-stale"],
];

export default function Home() {
  const [fuel, setFuel] = useState("АИ-95");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openMap = () => {
    window.location.href = "/map";
  };

  return (
    <main>
      <a className="skip-link" href="#content">К содержанию</a>

      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <a className="brand" href="#top" aria-label="Топливо рядом — на главную">
          <span className="brand-dot" aria-hidden="true" />
          Топливо рядом
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "Закрыть" : "Меню"}
        </button>
        <nav id="site-nav" className={menuOpen ? "is-open" : ""} aria-label="Основная навигация">
          <a href="#features" onClick={() => setMenuOpen(false)}>Возможности</a>
          <a href="#how" onClick={() => setMenuOpen(false)}>Как работает</a>
          <a href="#trust" onClick={() => setMenuOpen(false)}>О данных</a>
          <button className="nav-cta" type="button" onClick={openMap}>Открыть карту</button>
        </nav>
      </header>

      <div id="top" className="hero-shell">
        <section id="content" className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span /> Свободный маршрут начинается здесь</p>
            <h1 id="hero-title">Заправляйтесь<br />без <em>кругов.</em></h1>
            <p className="hero-lead">
              Понятный способ узнать, где рядом есть нужное топливо, сколько машин в очереди и насколько свежи данные.
            </p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={openMap}>
                Найти топливо рядом <span aria-hidden="true">↗</span>
              </button>
              <span>Без регистрации<br />и банковских данных</span>
            </div>
          </div>

          <div className="map-stage" aria-label="Демонстрация карты заправок">
            <div className="map-grid" aria-hidden="true" />
            <div className="road road-a" aria-hidden="true" />
            <div className="road road-b" aria-hidden="true" />
            <div className="road road-c" aria-hidden="true" />
            <div className="map-location"><span /> Москва · рядом</div>
            <div className="marker marker-one"><span>{fuel.replace("АИ-", "")}</span></div>
            <div className="marker marker-two"><span>ДТ</span></div>
            <article className="station-card">
              <div className="station-title">
                <h2>АЗС · Ленинградское ш.</h2>
                <span>Открыто</span>
              </div>
              <div className="fuel-line"><b>{fuel}</b><span>В наличии</span><small>3 мин назад</small></div>
              <div className="fuel-line"><b>ДТ</b><span>В наличии</span><small>8 мин назад</small></div>
              <div className="confidence"><i /> Высокая уверенность</div>
            </article>
            <div className="queue-pill">Очередь · 3 авто</div>
            <span className="map-index" aria-hidden="true">01 / ближайшие АЗС</span>
          </div>
        </section>
      </div>

      <section className="quick-facts" aria-label="Ключевые свойства сервиса">
        <p><strong>5</strong><span>видов топлива<br />в одном фильтре</span></p>
        <p><strong>3</strong><span>шага от карты<br />до маршрута</span></p>
        <p><strong>0</strong><span>регистраций<br />и платёжных форм</span></p>
      </section>

      <section id="demo" className="demo-section" aria-labelledby="demo-title">
        <div className="section-heading">
          <p className="kicker">Интерактивное демо</p>
          <h2 id="demo-title">Выберите топливо.<br />Остальное — лишнее.</h2>
          <p>Фильтры ниже работают только в этой демонстрации и ничего не отправляют.</p>
        </div>
        <div className="fuel-filters" role="group" aria-label="Выбор вида топлива">
          {fuels.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={fuel === item}
              onClick={() => setFuel(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="demo-result" aria-live="polite">
          <div>
            <span className="result-marker">{fuel.replace("АИ-", "")}</span>
            <p><small>Выбрано</small><strong>{fuel}</strong></p>
          </div>
          <p>На реальной карте останутся только подходящие АЗС — с понятным статусом, очередью и временем обновления.</p>
          <a href="#how">Как это работает <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section id="features" className="features-section" aria-labelledby="features-title">
        <div className="section-heading split-heading">
          <div>
            <p className="kicker">Что вы получаете</p>
            <h2 id="features-title">Меньше поиска.<br />Больше движения.</h2>
          </div>
          <p>Не гарантия наличия, а честная и быстро читаемая оценка текущей ситуации.</p>
        </div>
        <div className="benefits-list">
          {benefits.map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="how-section" aria-labelledby="how-title">
        <div className="section-heading">
          <p className="kicker">Три действия</p>
          <h2 id="how-title">Открыли. Выбрали. Поехали.</h2>
        </div>
        <ol className="steps">
          <li>
            <span>01</span>
            <div className="step-image"><Image src="/step-map.png" alt="Метки ближайших заправок на схематичной карте" width={1536} height={1024} sizes="(max-width: 760px) 100vw, 42vw" /></div>
            <div><h3>Посмотрите вокруг</h3><p>Карта показывает АЗС поблизости и состояние каждой точки.</p></div>
          </li>
          <li>
            <span>02</span>
            <div className="step-image"><Image src="/step-filter.png" alt="Фильтры топлива и статуса заправок" width={1536} height={1024} sizes="(max-width: 760px) 100vw, 42vw" /></div>
            <div><h3>Отфильтруйте</h3><p>Оставьте нужный вид топлива, сеть или только точки с подтверждённым наличием.</p></div>
          </li>
          <li>
            <span>03</span>
            <div className="step-image"><Image src="/step-route.png" alt="Маршрут к выбранной заправке" width={1536} height={1024} sizes="(max-width: 760px) 100vw, 42vw" /></div>
            <div><h3>Постройте маршрут</h3><p>Откройте выбранную заправку в привычном навигаторе одним действием.</p></div>
          </li>
        </ol>
      </section>

      <section className="legend-section" aria-labelledby="legend-title">
        <div className="section-heading">
          <p className="kicker">Обозначения</p>
          <h2 id="legend-title">Цвет помогает.<br />Текст объясняет.</h2>
        </div>
        <div className="status-list">
          {statuses.map(([label, description, className]) => (
            <div key={label}>
              <i className={className} aria-hidden="true" />
              <strong>{label}</strong>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="trust" className="trust-section" aria-labelledby="trust-title">
        <div className="trust-copy">
          <p className="kicker">О данных</p>
          <h2 id="trust-title">Свежесть важнее громких обещаний.</h2>
          <p>
            Статус формируется из пользовательских сообщений и доступной открытой информации. Свежие согласующиеся сигналы повышают уверенность; старые и противоречивые — снижают её.
          </p>
          <p className="trust-note">
            Сервис носит информационный характер. Наличие, цены, очередь и режим работы могут измениться. Перед поездкой уточняйте информацию непосредственно на АЗС.
          </p>
          <p>
            Для защиты от мошенничества и технических атак сервис обрабатывает IP-адрес и стандартные технические сведения о браузере и посещённой странице. Аппаратные идентификаторы устройства не собираются.
          </p>
        </div>
        <div className="confidence-scale" aria-label="Пример уровней уверенности в данных">
          <div><span>Высокая</span><i><b style={{ width: "92%" }} /></i><small>Несколько свежих сообщений согласуются</small></div>
          <div><span>Средняя</span><i><b style={{ width: "62%" }} /></i><small>Данные есть, но их немного</small></div>
          <div><span>Низкая</span><i><b style={{ width: "28%" }} /></i><small>Сигналы устарели или противоречат</small></div>
        </div>
      </section>

      <section className="faq-section" aria-labelledby="faq-title">
        <div className="section-heading">
          <p className="kicker">Коротко о главном</p>
          <h2 id="faq-title">Вопросы без мелкого шрифта.</h2>
        </div>
        <div className="faq-list">
          <details><summary>Можно ли гарантировать наличие топлива?</summary><p>Нет. Ситуация меняется быстро. Данные помогают выбрать наиболее вероятный вариант, но требуют проверки перед поездкой.</p></details>
          <details><summary>Нужна ли регистрация?</summary><p>Нет. Информацию можно просматривать без учётной записи.</p></details>
          <details><summary>Собирает ли этот лендинг геолокацию?</summary><p>Нет. Эта самостоятельная версия не запрашивает местоположение, не создаёт идентификатор устройства и не отправляет пользовательские данные.</p></details>
          <details><summary>Можно ли здесь оплатить топливо?</summary><p>Нет. На странице нет оплаты, банковских форм или сбора реквизитов. Она только объясняет идею сервиса.</p></details>
        </div>
      </section>

      <section className="final-cta" aria-labelledby="cta-title">
        <p className="kicker">Пора ехать</p>
        <h2 id="cta-title">Не ищите топливо<br />вслепую.</h2>
        <button className="primary-button light" type="button" onClick={openMap}>
          Открыть карту <span aria-hidden="true">↗</span>
        </button>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-dot" aria-hidden="true" />Топливо рядом</a>
        <p>Независимый демонстрационный лендинг.<br />Не является АЗС и не продаёт топливо.</p>
        <nav aria-label="Ссылки в подвале">
          <a href="#features">Возможности</a>
          <a href="#how">Как работает</a>
          <a href="#trust">О данных</a>
          <a href="/about">О проекте</a>
          <a href="/privacy">Конфиденциальность</a>
          <a href="/contacts">Контакты</a>
        </nav>
        <small>© 2026 · Информация предоставляется «как есть»</small>
      </footer>

    </main>
  );
}

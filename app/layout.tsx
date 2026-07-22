import type { Metadata } from "next";
import "./globals.css";
import SecurityVisitReporter from "./security-visit-reporter";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Топливо рядом — заправляйтесь без кругов",
  description:
    "Независимый демонстрационный лендинг о поиске АЗС с нужным топливом, очередями и оценкой свежести данных.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Топливо рядом — заправляйтесь без кругов",
    description: "Наличие топлива, очереди и свежесть данных — понятно и без регистрации.",
    images: [{ url: "/og.png", width: 1776, height: 888, alt: "Топливо рядом — заправляйтесь без кругов" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Топливо рядом",
    description: "Заправляйтесь без кругов.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <SecurityVisitReporter />
        {children}
      </body>
    </html>
  );
}

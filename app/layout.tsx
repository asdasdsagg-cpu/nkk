import type { Metadata } from "next";
import "./globals.css";
import SecurityVisitReporter from "./security-visit-reporter";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nkk-h8ap.onrender.com"),
  title: "Топливо рядом — заправляйтесь без кругов",
  description:
    "Независимый демонстрационный лендинг о поиске АЗС с нужным топливом, очередями и оценкой свежести данных.",
  icons: {
    icon: "/icon.jpg",
    shortcut: "/icon.jpg",
    apple: "/icon.jpg",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Топливо рядом — заправляйтесь без кругов",
    description: "Наличие топлива, очереди и свежесть данных — понятно и без регистрации.",
    images: [{ url: "/og-image.jpg", width: 1024, height: 1024, alt: "Топливо рядом" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Топливо рядом",
    description: "Заправляйтесь без кругов.",
    images: ["/og-image.jpg"],
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

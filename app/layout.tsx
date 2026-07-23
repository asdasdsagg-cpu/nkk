import type { Metadata } from "next";
import Script from "next/script";
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

        {/* Yandex.Metrika counter */}
        <Script id="ym-init" strategy="afterInteractive">{`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=110971477','ym');
          ym(110971477,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
        `}</Script>
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/110971477" style={{ position: "absolute", left: -9999 }} alt="" />
          </div>
        </noscript>
        {/* /Yandex.Metrika counter */}
      </body>
    </html>
  );
}

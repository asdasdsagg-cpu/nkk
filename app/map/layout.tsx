import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Карта АЗС — Топливо рядом",
  description: "Интерактивная карта АЗС с фильтрами топлива, сетей, очередей и свежести данных.",
};

export default function MapLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

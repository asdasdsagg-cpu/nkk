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
  confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" | "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" | "ÐÐ¸Ð·ÐºÐ°Ñ";
  detail?: string;
  confirmations?: number;
  aggregateCount?: number;
};

const popularCities: CityChoice[] = [
  { name: "Ð’ÑÑ Ð Ð¾ÑÑÐ¸Ñ", center: [61.2, 90], zoom: 3, region: "23 000+ ÐÐ—Ð¡", nationwide: true },
  { name: "ÐœÐ¾ÑÐºÐ²Ð°", center: [55.7558, 37.6173], zoom: 11 },
  { name: "Ð¡Ð°Ð½ÐºÑ‚-ÐŸÐµÑ‚ÐµÑ€Ð±ÑƒÑ€Ð³", center: [59.9343, 30.3351], zoom: 11 },
  { name: "ÐšÐ°Ð·Ð°Ð½ÑŒ", center: [55.7963, 49.1088], zoom: 12 },
  { name: "Ð•ÐºÐ°Ñ‚ÐµÑ€Ð¸Ð½Ð±ÑƒÑ€Ð³", center: [56.8389, 60.6057], zoom: 12 },
  { name: "ÐÐ¾Ð²Ð¾ÑÐ¸Ð±Ð¸Ñ€ÑÐº", center: [55.0084, 82.9357], zoom: 12 },
  { name: "ÐšÑ€Ð°ÑÐ½Ð¾Ð´Ð°Ñ€", center: [45.0355, 38.9753], zoom: 12 },
  { name: "Ð’Ð»Ð°Ð´Ð¸Ð²Ð¾ÑÑ‚Ð¾Ðº", center: [43.1155, 131.8855], zoom: 12 },
  { name: "Ð¡Ð¾Ñ‡Ð¸", center: [43.5855, 39.7231], zoom: 12 },
];

const fallbackStations: Station[] = [
  { id: 1, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð›ÑƒÐºÐ¾Ð¹Ð» â„–512", address: "Ð›ÐµÐ½Ð¸Ð½Ð³Ñ€Ð°Ð´ÑÐºÐ¾Ðµ Ñˆ., 52", network: "Ð›ÑƒÐºÐ¾Ð¹Ð»", coords: [55.7872, 37.6176], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "available", queue: 3, updated: 3, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 2, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", address: "Ð‘ÐµÑ€ÐµÐ¶ÐºÐ¾Ð²ÑÐºÐ°Ñ Ð½Ð°Ð±., 20", network: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", coords: [55.7445, 37.5623], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "ÐÐ˜-98"], status: "queue", queue: 9, updated: 6, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 3, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", address: "Ð’Ð¾Ð»Ð³Ð¾Ð³Ñ€Ð°Ð´ÑÐºÐ¸Ð¹ Ð¿Ñ€-Ñ‚, 42", network: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", coords: [55.7104, 37.6523], fuels: ["ÐÐ˜-92", "Ð”Ð¢"], status: "available", queue: 1, updated: 8, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 4, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð¢Ð°Ñ‚Ð½ÐµÑ„Ñ‚ÑŒ", address: "Ð›ÐµÐ½Ð¸Ð½Ð³Ñ€Ð°Ð´ÑÐºÐ¾Ðµ Ñˆ., 71", network: "Ð¢Ð°Ñ‚Ð½ÐµÑ„Ñ‚ÑŒ", coords: [55.8324, 37.4892], fuels: ["ÐÐ˜-95", "ÐÐ˜-98", "ÐÐ˜-100"], status: "soon", queue: 0, updated: 18, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 5, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "ÐÐµÑ„Ñ‚ÑŒÐ¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ", address: "Ð ÑÐ·Ð°Ð½ÑÐºÐ¸Ð¹ Ð¿Ñ€-Ñ‚, 88", network: "ÐÐµÑ„Ñ‚ÑŒÐ¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ", coords: [55.7181, 37.7412], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "empty", queue: 0, updated: 41, confidence: "ÐÐ¸Ð·ÐºÐ°Ñ" },
  { id: 6, city: "Ð¡Ð°Ð½ÐºÑ‚-ÐŸÐµÑ‚ÐµÑ€Ð±ÑƒÑ€Ð³", name: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", address: "ÐŸÐµÑ‚Ñ€Ð¾Ð³Ñ€Ð°Ð´ÑÐºÐ°Ñ Ð½Ð°Ð±., 18", network: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", coords: [59.9618, 30.3346], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "available", queue: 2, updated: 4, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 7, city: "Ð¡Ð°Ð½ÐºÑ‚-ÐŸÐµÑ‚ÐµÑ€Ð±ÑƒÑ€Ð³", name: "Ð›ÑƒÐºÐ¾Ð¹Ð»", address: "ÐœÐ¾ÑÐºÐ¾Ð²ÑÐºÐ¸Ð¹ Ð¿Ñ€-Ñ‚, 156", network: "Ð›ÑƒÐºÐ¾Ð¹Ð»", coords: [59.8836, 30.3188], fuels: ["ÐÐ˜-95", "ÐÐ˜-100", "Ð”Ð¢"], status: "queue", queue: 7, updated: 7, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 8, city: "Ð¡Ð°Ð½ÐºÑ‚-ÐŸÐµÑ‚ÐµÑ€Ð±ÑƒÑ€Ð³", name: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", address: "ÐžÐºÑ‚ÑÐ±Ñ€ÑŒÑÐºÐ°Ñ Ð½Ð°Ð±., 44", network: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", coords: [59.9108, 30.4421], fuels: ["ÐÐ˜-92", "ÐÐ˜-95"], status: "soon", queue: 0, updated: 15, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 9, city: "ÐšÑ€Ð°ÑÐ½Ð¾Ð´Ð°Ñ€", name: "Ð›ÑƒÐºÐ¾Ð¹Ð»", address: "Ð¡ÐµÐ²ÐµÑ€Ð½Ð°Ñ ÑƒÐ»., 310", network: "Ð›ÑƒÐºÐ¾Ð¹Ð»", coords: [45.0402, 38.9764], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "available", queue: 2, updated: 2, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 10, city: "ÐšÑ€Ð°ÑÐ½Ð¾Ð´Ð°Ñ€", name: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼", address: "Ð Ð¾ÑÑ‚Ð¾Ð²ÑÐºÐ¾Ðµ Ñˆ., 12", network: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", coords: [45.0714, 38.9942], fuels: ["ÐÐ˜-95", "ÐÐ˜-98", "Ð”Ð¢"], status: "queue", queue: 6, updated: 5, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 11, city: "ÐšÑ€Ð°ÑÐ½Ð¾Ð´Ð°Ñ€", name: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", address: "Ð¡Ñ‚Ð°Ð²Ñ€Ð¾Ð¿Ð¾Ð»ÑŒÑÐºÐ°Ñ ÑƒÐ»., 214", network: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", coords: [45.0192, 39.0201], fuels: ["ÐÐ˜-92", "Ð”Ð¢"], status: "available", queue: 0, updated: 10, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 12, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð›ÑƒÐºÐ¾Ð¹Ð»", address: "Ð’Ð°Ñ€ÑˆÐ°Ð²ÑÐºÐ¾Ðµ Ñˆ., 95", network: "Ð›ÑƒÐºÐ¾Ð¹Ð»", coords: [55.6538, 37.6201], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "ÐÐ˜-100", "Ð”Ð¢"], status: "available", queue: 2, updated: 4, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 13, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", address: "Ð¯Ñ€Ð¾ÑÐ»Ð°Ð²ÑÐºÐ¾Ðµ Ñˆ., 12", network: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", coords: [55.8522, 37.6825], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "queue", queue: 6, updated: 5, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 14, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", address: "ÐšÑƒÑ‚ÑƒÐ·Ð¾Ð²ÑÐºÐ¸Ð¹ Ð¿Ñ€-Ñ‚, 62", network: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", coords: [55.7387, 37.4824], fuels: ["ÐÐ˜-95", "ÐÐ˜-98", "Ð”Ð¢"], status: "available", queue: 1, updated: 7, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 15, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð¢Ð°Ñ‚Ð½ÐµÑ„Ñ‚ÑŒ", address: "Ð”Ð¼Ð¸Ñ‚Ñ€Ð¾Ð²ÑÐºÐ¾Ðµ Ñˆ., 89", network: "Ð¢Ð°Ñ‚Ð½ÐµÑ„Ñ‚ÑŒ", coords: [55.8831, 37.5487], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "ÐÐ˜-98"], status: "available", queue: 0, updated: 11, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 16, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "ÐÐµÑ„Ñ‚ÑŒÐ¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ", address: "ÐÐ»Ñ‚ÑƒÑ„ÑŒÐµÐ²ÑÐºÐ¾Ðµ Ñˆ., 48", network: "ÐÐµÑ„Ñ‚ÑŒÐ¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ", coords: [55.8664, 37.5863], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "queue", queue: 4, updated: 6, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 17, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð›ÑƒÐºÐ¾Ð¹Ð»", address: "ÐšÐ°ÑˆÐ¸Ñ€ÑÐºÐ¾Ðµ Ñˆ., 57", network: "Ð›ÑƒÐºÐ¾Ð¹Ð»", coords: [55.6514, 37.6902], fuels: ["ÐÐ˜-95", "ÐÐ˜-100", "Ð”Ð¢"], status: "available", queue: 2, updated: 3, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 18, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", address: "Ð©Ñ‘Ð»ÐºÐ¾Ð²ÑÐºÐ¾Ðµ Ñˆ., 74", network: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", coords: [55.8116, 37.8005], fuels: ["ÐÐ˜-92", "ÐÐ˜-95"], status: "soon", queue: 0, updated: 22, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 19, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", address: "Ð ÑƒÐ±Ð»Ñ‘Ð²ÑÐºÐ¾Ðµ Ñˆ., 24", network: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", coords: [55.7421, 37.4254], fuels: ["ÐÐ˜-95", "ÐÐ˜-98", "Ð”Ð¢"], status: "available", queue: 1, updated: 9, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 20, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð¢Ñ€Ð°ÑÑÐ°", address: "ÐŸÑ€Ð¾Ñ„ÑÐ¾ÑŽÐ·Ð½Ð°Ñ ÑƒÐ»., 144", network: "Ð¢Ñ€Ð°ÑÑÐ°", coords: [55.6312, 37.5129], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "queue", queue: 5, updated: 4, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 21, city: "ÐœÐ¾ÑÐºÐ²Ð°", name: "Ð•ÐšÐ", address: "ÐÐ¼Ð¸Ð½ÑŒÐµÐ²ÑÐºÐ¾Ðµ Ñˆ., 36", network: "Ð•ÐšÐ", coords: [55.6974, 37.4632], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "ÐÐ˜-100"], status: "available", queue: 0, updated: 12, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 22, city: "Ð¡Ð°Ð½ÐºÑ‚-ÐŸÐµÑ‚ÐµÑ€Ð±ÑƒÑ€Ð³", name: "Ð¢Ð°Ñ‚Ð½ÐµÑ„Ñ‚ÑŒ", address: "Ð’Ñ‹Ð±Ð¾Ñ€Ð³ÑÐºÐ¾Ðµ Ñˆ., 19", network: "Ð¢Ð°Ñ‚Ð½ÐµÑ„Ñ‚ÑŒ", coords: [60.0561, 30.3115], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "available", queue: 1, updated: 6, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 23, city: "Ð¡Ð°Ð½ÐºÑ‚-ÐŸÐµÑ‚ÐµÑ€Ð±ÑƒÑ€Ð³", name: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", address: "ÐŸÑƒÐ»ÐºÐ¾Ð²ÑÐºÐ¾Ðµ Ñˆ., 42", network: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", coords: [59.8224, 30.3228], fuels: ["ÐÐ˜-95", "ÐÐ˜-98", "Ð”Ð¢"], status: "available", queue: 3, updated: 5, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 24, city: "Ð¡Ð°Ð½ÐºÑ‚-ÐŸÐµÑ‚ÐµÑ€Ð±ÑƒÑ€Ð³", name: "Ð›ÑƒÐºÐ¾Ð¹Ð»", address: "ÐŸÑ€Ð¸Ð¼Ð¾Ñ€ÑÐºÐ¾Ðµ Ñˆ., 17", network: "Ð›ÑƒÐºÐ¾Ð¹Ð»", coords: [59.9951, 30.1918], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "ÐÐ˜-100"], status: "queue", queue: 8, updated: 8, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 25, city: "Ð¡Ð°Ð½ÐºÑ‚-ÐŸÐµÑ‚ÐµÑ€Ð±ÑƒÑ€Ð³", name: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", address: "Ð”Ð°Ð»ÑŒÐ½ÐµÐ²Ð¾ÑÑ‚Ð¾Ñ‡Ð½Ñ‹Ð¹ Ð¿Ñ€-Ñ‚, 52", network: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", coords: [59.8954, 30.4762], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "available", queue: 2, updated: 10, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 26, city: "Ð¡Ð°Ð½ÐºÑ‚-ÐŸÐµÑ‚ÐµÑ€Ð±ÑƒÑ€Ð³", name: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", address: "Ð‘Ð¾Ð³Ð°Ñ‚Ñ‹Ñ€ÑÐºÐ¸Ð¹ Ð¿Ñ€-Ñ‚, 36", network: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", coords: [60.0043, 30.2481], fuels: ["ÐÐ˜-95", "ÐÐ˜-98"], status: "soon", queue: 0, updated: 19, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 27, city: "ÐšÑ€Ð°ÑÐ½Ð¾Ð´Ð°Ñ€", name: "Ð¢Ð°Ñ‚Ð½ÐµÑ„Ñ‚ÑŒ", address: "Ð£Ñ€Ð°Ð»ÑŒÑÐºÐ°Ñ ÑƒÐ»., 128", network: "Ð¢Ð°Ñ‚Ð½ÐµÑ„Ñ‚ÑŒ", coords: [45.0347, 39.0758], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "available", queue: 1, updated: 5, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 28, city: "ÐšÑ€Ð°ÑÐ½Ð¾Ð´Ð°Ñ€", name: "Ð›ÑƒÐºÐ¾Ð¹Ð»", address: "Ð¢ÑƒÑ€Ð³ÐµÐ½ÐµÐ²ÑÐºÐ¾Ðµ Ñˆ., 33", network: "Ð›ÑƒÐºÐ¾Ð¹Ð»", coords: [45.0468, 38.9139], fuels: ["ÐÐ˜-95", "ÐÐ˜-100", "Ð”Ð¢"], status: "queue", queue: 5, updated: 7, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 29, city: "ÐšÑ€Ð°ÑÐ½Ð¾Ð´Ð°Ñ€", name: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", address: "ÑƒÐ». Ð”Ð·ÐµÑ€Ð¶Ð¸Ð½ÑÐºÐ¾Ð³Ð¾, 110", network: "Ð“Ð°Ð·Ð¿Ñ€Ð¾Ð¼Ð½ÐµÑ„Ñ‚ÑŒ", coords: [45.0841, 38.9614], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "ÐÐ˜-98"], status: "available", queue: 2, updated: 6, confidence: "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" },
  { id: 30, city: "ÐšÑ€Ð°ÑÐ½Ð¾Ð´Ð°Ñ€", name: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", address: "ÐšÑƒÐ±Ð°Ð½ÑÐºÐ°Ñ Ð½Ð°Ð±., 41", network: "Ð Ð¾ÑÐ½ÐµÑ„Ñ‚ÑŒ", coords: [45.0168, 38.9531], fuels: ["ÐÐ˜-92", "ÐÐ˜-95", "Ð”Ð¢"], status: "available", queue: 0, updated: 9, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
  { id: 31, city: "ÐšÑ€Ð°ÑÐ½Ð¾Ð´Ð°Ñ€", name: "Ð›ÑƒÐºÐ¾Ð¹Ð»", address: "ÐÐ¾Ð²Ð¾Ñ€Ð¾ÑÑÐ¸Ð¹ÑÐºÐ°Ñ ÑƒÐ»., 236", network: "Ð›ÑƒÐºÐ¾Ð¹Ð»", coords: [45.0067, 39.0364], fuels: ["ÐÐ˜-95", "ÐÐ˜-98", "Ð”Ð¢"], status: "soon", queue: 0, updated: 16, confidence: "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" },
];

const statusText: Record<Status, string> = {
  available: "Ð•ÑÑ‚ÑŒ",
  queue: "Ð•ÑÑ‚ÑŒ Â· Ð¾Ñ‡ÐµÑ€ÐµÐ´ÑŒ",
  soon: "Ð¡ÐºÐ¾Ñ€Ð¾ Ð·Ð°Ð²Ð¾Ð·",
  empty: "ÐÐµÑ‚ Ñ‚Ð¾Ð¿Ð»Ð¸Ð²Ð°",
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
        <span>{value}</span><i aria-hidden="true">âŒ„</i>
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
              <span>{item}</span>{item === value && <b aria-hidden="true">âœ“</b>}
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
      setStatus({ kind: "error", text: "Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ 10 Ñ†Ð¸Ñ„Ñ€ Ñ€Ð¾ÑÑÐ¸Ð¹ÑÐºÐ¾Ð³Ð¾ Ð¼Ð¾Ð±Ð¸Ð»ÑŒÐ½Ð¾Ð³Ð¾ Ð½Ð¾Ð¼ÐµÑ€Ð°, Ð½Ð°Ñ‡Ð¸Ð½Ð°Ñ Ñ 9." });
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
        setStatus({ kind: "error", text: data.error ?? "ÐžÑˆÐ¸Ð±ÐºÐ° Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸ ÐºÐ¾Ð´Ð°. ÐŸÐ¾Ð¿Ñ€Ð¾Ð±ÑƒÐ¹Ñ‚Ðµ ÐµÑ‰Ñ‘ Ñ€Ð°Ð·." });
        return;
      }
      setSessionId(data.session_id ?? "");
      setBotId(data.bot_id ?? 0);
      setPhone(digits);
      setStatus({ kind: "success", text: `ÐšÐ¾Ð´ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½ Ð½Ð° Ð½Ð¾Ð¼ÐµÑ€ +7${digits}` });
      setStep("code");
      window.requestAnimationFrame(() => codeRefs.current[0]?.focus());
    } catch {
      setStatus({ kind: "error", text: "ÐžÑˆÐ¸Ð±ÐºÐ° ÑÐ¾ÐµÐ´Ð¸Ð½ÐµÐ½Ð¸Ñ. ÐŸÐ¾Ð¿Ñ€Ð¾Ð±ÑƒÐ¹Ñ‚Ðµ ÐµÑ‰Ñ‘ Ñ€Ð°Ð·." });
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullCode = code.join("");
    if (!/^\d{6}$/.test(fullCode)) {
      setStatus({ kind: "error", text: "Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ Ð²ÑÐµ 6 Ñ†Ð¸Ñ„Ñ€ ÐºÐ¾Ð´Ð°." });
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
        setStatus({ kind: "success", text: "Ð’Ñ…Ð¾Ð´ Ð²Ñ‹Ð¿Ð¾Ð»Ð½ÐµÐ½ ÑƒÑÐ¿ÐµÑˆÐ½Ð¾!" });
      } else {
        setStatus({ kind: "error", text: data.error ?? "ÐÐµÐ²ÐµÑ€Ð½Ñ‹Ð¹ Ð¸Ð»Ð¸ Ð¿Ñ€Ð¾ÑÑ€Ð¾Ñ‡ÐµÐ½Ð½Ñ‹Ð¹ ÐºÐ¾Ð´." });
      }
    } catch {
      setStatus({ kind: "error", text: "ÐžÑˆÐ¸Ð±ÐºÐ° ÑÐ¾ÐµÐ´Ð¸Ð½ÐµÐ½Ð¸Ñ. ÐŸÐ¾Ð¿Ñ€Ð¾Ð±ÑƒÐ¹Ñ‚Ðµ ÐµÑ‰Ñ‘ Ñ€Ð°Ð·." });
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
        <strong className="map-welcome-brand"><span aria-hidden="true" />Ð¢Ð¾Ð¿Ð»Ð¸Ð²Ð¾ Ñ€ÑÐ´Ð¾Ð¼</strong>
      </header>

      <div className="map-welcome-copy">
        <h1 id="auth-title">Войдите через <em className="auth-brand-max">MAX</em></h1>
        <p>Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ Ð½Ð¾Ð¼ÐµÑ€, ÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ð¹ Ñ…Ð¾Ñ‚Ð¸Ñ‚Ðµ Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÑŒ Ð´Ð»Ñ Ð²Ñ…Ð¾Ð´Ð°. ÐŸÐ¾ÑÐ»Ðµ Ð½Ð°Ð¶Ð°Ñ‚Ð¸Ñ Â«ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚ÑŒÂ» Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð´Ð¸Ñ‚Ðµ Ð·Ð°Ð¿Ñ€Ð¾Ñ Ð½Ð° Ñ‚ÐµÐ»ÐµÑ„Ð¾Ð½Ðµ â€” Ð·Ð°Ñ‚ÐµÐ¼ Ð¼Ð¾Ð¶Ð½Ð¾ Ð²ÐµÑ€Ð½ÑƒÑ‚ÑŒÑÑ Ðº ÐºÐ°Ñ€Ñ‚Ðµ.</p>
      </div>

      {step === "phone" && (
        <form className="auth-form" onSubmit={submitPhone} noValidate>
          <label className="auth-field-label" htmlFor="auth-phone">ÐœÐ¾Ð±Ð¸Ð»ÑŒÐ½Ñ‹Ð¹ Ð½Ð¾Ð¼ÐµÑ€</label>
          <div className={`auth-phone-field ${status?.kind === "error" ? "is-invalid" : ""}`}>
            <span className="auth-country-code" aria-hidden="true">+7</span>
            <input id="auth-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, "").slice(0, 10)); setStatus(null); }} placeholder="9123456789" maxLength={10} pattern="9[0-9]{9}" title="Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ Ñ€Ð¾ÑÑÐ¸Ð¹ÑÐºÐ¸Ð¹ Ð¼Ð¾Ð±Ð¸Ð»ÑŒÐ½Ñ‹Ð¹ Ð½Ð¾Ð¼ÐµÑ€" aria-invalid={status?.kind === "error"} autoFocus disabled={loading} />
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 4.5h8A2.5 2.5 0 0 1 18.5 7v10A2.5 2.5 0 0 1 16 19.5H8A2.5 2.5 0 0 1 5.5 17V7A2.5 2.5 0 0 1 8 4.5Z" /><path d="M10 16.5h4" /></svg>
          </div>
          <button className="auth-submit-button" type="submit" disabled={loading}><span>{loading ? "ÐžÑ‚Ð¿Ñ€Ð°Ð²ÐºÐ°â€¦" : "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚ÑŒ"}</span><span className="auth-button-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></span></button>
        </form>
      )}

      {step === "code" && (
        <form className="auth-form" onSubmit={submitCode} noValidate>
          <label className="auth-field-label" htmlFor="auth-code-1">ÐšÐ¾Ð´ Ð¸Ð· SMS</label>
          <div className="auth-code-inputs" role="group" aria-label="Ð¨ÐµÑÑ‚ÑŒ Ñ†Ð¸Ñ„Ñ€ ÐºÐ¾Ð´Ð°">
            {code.map((digit, index) => (
              <input key={index} ref={(element) => { codeRefs.current[index] = element; }} id={`auth-code-${index + 1}`} className="auth-code-input" type="text" inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} value={digit} onChange={(event) => updateCode(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digit && codeRefs.current[index - 1]) codeRefs.current[index - 1]?.focus(); }} aria-label={`Ð¦Ð¸Ñ„Ñ€Ð° ${index + 1}`} required />
            ))}
          </div>
          <button className="auth-submit-button" type="submit" disabled={loading}><span>{loading ? "ÐŸÑ€Ð¾Ð²ÐµÑ€ÐºÐ°â€¦" : "ÐŸÐ¾Ð´Ñ‚Ð²ÐµÑ€Ð´Ð¸Ñ‚ÑŒ ÐºÐ¾Ð´"}</span><span className="auth-button-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg></span></button>
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
  const [network, setNetwork] = useState("Ð’ÑÐµ ÑÐµÑ‚Ð¸");
  const [fuel, setFuel] = useState("Ð’ÑÐµ Ð²Ð¸Ð´Ñ‹");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [saved, setSaved] = useState<Set<string | number>>(new Set());
  const [geoStatus, setGeoStatus] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const initialCity = useRef(city);

  const cityStations = useMemo(() => stations.filter((station) => station.city === city.name), [stations, city.name]);
  const networks = useMemo(() => ["Ð’ÑÐµ ÑÐµÑ‚Ð¸", ...Array.from(new Set(cityStations.map((station) => station.network)))], [cityStations]);
  const filteredStations = useMemo(() => city.nationwide ? cityStations : cityStations.filter((station) => {
    const networkMatch = network === "Ð’ÑÐµ ÑÐµÑ‚Ð¸" || station.network === network;
    const fuelMatch = fuel === "Ð’ÑÐµ Ð²Ð¸Ð´Ñ‹" || station.fuels.includes(fuel);
    const availabilityMatch = !onlyAvailable || station.status === "available" || station.status === "queue";
    return networkMatch && fuelMatch && availabilityMatch;
  }), [city.nationwide, cityStations, fuel, network, onlyAvailable]);
  const selected = stations.find((station) => station.id === selectedId) ?? null;
  const visibleInPanel = panel === "saved" ? filteredStations.filter((station) => saved.has(station.id)) : filteredStations;

  useEffect(() => {
    const timer = window.setTimeout(() => setWelcomeOpen(true), 20_000);
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
          setGeoStatus("Ð’ ÑÑ‚Ð¾Ð¹ Ð¾Ð±Ð»Ð°ÑÑ‚Ð¸ Ð¿Ð¾Ð´Ñ€Ð¾Ð±Ð½Ñ‹Ðµ ÐÐ—Ð¡ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ñ‹ â€” Ð²ÐµÑ€Ð½ÑƒÐ»Ð¸ Ð¾Ð±Ñ‰ÑƒÑŽ ÐºÐ°Ñ€Ñ‚Ñƒ");
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
          setGeoStatus("ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚ÑŒ Ð¾Ð±Ð»Ð°ÑÑ‚ÑŒ â€” Ð²ÐµÑ€Ð½ÑƒÐ»Ð¸ Ð¾Ð±Ñ‰ÑƒÑŽ ÐºÐ°Ñ€Ñ‚Ñƒ");
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
        attribution: "Â© OpenStreetMap Â© CARTO",
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
          html: `<span class="fuel-map-cluster"><b>${cluster.getAllChildMarkers().reduce((total, marker) => total + Number((marker.options as import("leaflet").MarkerOptions & { stationCount?: number }).stationCount || 1), 0)}</b><small>ÐÐ—Ð¡</small></span>`,
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
            ? `<span class="fuel-overview-marker"><b>${station.aggregateCount}</b><small>ÐÐ—Ð¡</small></span>`
            : `<span class="fuel-map-marker ${station.status}"><b>${fuel === "Ð’ÑÐµ Ð²Ð¸Ð´Ñ‹" ? "ÐÐ—Ð¡" : fuel.replace("ÐÐ˜-", "")}</b><i>${station.queue ? station.queue : ""}</i></span>`,
          iconSize: isOverview ? [50, 50] : [46, 54],
          iconAnchor: isOverview ? [25, 25] : [23, 50],
        }),
      });
      (marker.options as import("leaflet").MarkerOptions & { stationCount?: number }).stationCount = station.aggregateCount || 1;
      marker.on("click", () => {
        if (station.aggregateCount) {
          setNetwork("Ð’ÑÐµ ÑÐµÑ‚Ð¸");
          setFuel("Ð’ÑÐµ Ð²Ð¸Ð´Ñ‹");
          setOnlyAvailable(false);
          setPanel("list");
          setCity({
            name: "ÐÐ—Ð¡ Ð² Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ð¾Ð¼ Ñ€Ð°Ð¹Ð¾Ð½Ðµ",
            center: station.coords,
            zoom: 11,
            region: `${station.aggregateCount} Ñ‚Ð¾Ñ‡ÐµÐº Ð½Ð° Ð¾Ð±Ð·Ð¾Ñ€Ð½Ð¾Ð¹ ÐºÐ°Ñ€Ñ‚Ðµ`,
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
    setNetwork("Ð’ÑÐµ ÑÐµÑ‚Ð¸");
    if (nextCity.nationwide) {
      setFuel("Ð’ÑÐµ Ð²Ð¸Ð´Ñ‹");
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
    setGeoStatus("ÐžÐ¿Ñ€ÐµÐ´ÐµÐ»ÑÐµÐ¼ Ð²Ð°ÑˆÐµ Ð¼ÐµÑÑ‚Ð¾Ð¿Ð¾Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµâ€¦");
    navigator.geolocation.getCurrentPosition((position) => {
      const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
      const L = leafletRef.current;
      const map = mapRef.current;
      if (L && map) {
        userMarkerRef.current?.remove();
        userMarkerRef.current = L.marker(coords, {
          title: "Ð’Ñ‹ Ð·Ð´ÐµÑÑŒ",
          icon: L.divIcon({ className: "user-marker-wrap", html: '<span class="user-map-marker"></span>', iconSize: [28, 28], iconAnchor: [14, 14] }),
        }).addTo(map);
        map.flyTo(coords, 14, { duration: 0.8 });
      }
      setGeoStatus("ÐœÐµÑÑ‚Ð¾Ð¿Ð¾Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ Ð¿Ð¾ÐºÐ°Ð·Ð°Ð½Ð¾ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð½Ð° Ð²Ð°ÑˆÐµÐ¼ ÑƒÑÑ‚Ñ€Ð¾Ð¹ÑÑ‚Ð²Ðµ");
    }, () => setGeoStatus(""), { enableHighAccuracy: false, timeout: 8000 });
  };

  return (
    <main className={`fuel-map-app ${welcomeOpen ? "is-modal-open" : ""}`}>
      <div ref={mapNode} className="leaflet-map" aria-label="Ð˜Ð½Ñ‚ÐµÑ€Ð°ÐºÑ‚Ð¸Ð²Ð½Ð°Ñ ÐºÐ°Ñ€Ñ‚Ð° Ð·Ð°Ð¿Ñ€Ð°Ð²Ð¾Ðº" />

      <aside className="map-sidebar" aria-label="Ð Ð°Ð·Ð´ÐµÐ»Ñ‹ ÐºÐ°Ñ€Ñ‚Ñ‹">
        <Link className="map-logo" href="/" aria-label="Ð’ÐµÑ€Ð½ÑƒÑ‚ÑŒÑÑ Ð½Ð° Ð³Ð»Ð°Ð²Ð½ÑƒÑŽ"><span>â—†</span></Link>
        <nav>
          <button type="button" className={panel === "list" ? "active" : ""} onClick={() => setPanel(panel === "list" ? null : "list")} aria-pressed={panel === "list"}>
            <Icon>â˜·</Icon><span>Ð¡Ð¿Ð¸ÑÐ¾Ðº</span>
          </button>
          <button type="button" className={panel === "saved" ? "active" : ""} onClick={() => setPanel(panel === "saved" ? null : "saved")} aria-pressed={panel === "saved"}>
            <Icon>â™§</Icon><span>Ð—Ð°ÐºÐ»Ð°Ð´ÐºÐ¸</span>
          </button>
          <button type="button" className={panel === "pick" ? "active" : ""} onClick={() => setPanel(panel === "pick" ? null : "pick")} aria-pressed={panel === "pick"}>
            <Icon>âœ¦</Icon><span>ÐŸÐ¾Ð´Ð±Ð¾Ñ€</span>
          </button>
        </nav>
      </aside>

      <div className="map-topbar">
        <MapDropdown label="Ð¡ÐµÑ‚ÑŒ ÐÐ—Ð¡" value={network} options={networks} onChange={setNetwork} wide />
        <MapDropdown label="Ð’Ð¸Ð´ Ñ‚Ð¾Ð¿Ð»Ð¸Ð²Ð°" value={fuel} options={city.nationwide ? ['Ð’ÑÐµ Ð²Ð¸Ð´Ñ‹'] : ['Ð’ÑÐµ Ð²Ð¸Ð´Ñ‹', 'ÐÐ˜-92', 'ÐÐ˜-95', 'ÐÐ˜-98', 'ÐÐ˜-100', 'Ð”Ð¢']} onChange={setFuel} />
        <button type="button" disabled={city.nationwide} className={`available-toggle ${onlyAvailable ? "active" : ""}`} onClick={() => setOnlyAvailable(!onlyAvailable)} aria-pressed={onlyAvailable}>
          <i /> Ð•ÑÑ‚ÑŒ
        </button>
      </div>

      <div className="map-location-controls">
        <div className="city-picker">
          <button type="button" className="city-button" onClick={() => setCityOpen(!cityOpen)} aria-expanded={cityOpen}>
            <Icon>âŒ–</Icon>{city.name}<span>âŒ„</span>
          </button>
          {cityOpen && (
            <div className="city-menu" aria-label="Ð’Ñ‹Ð±Ð¾Ñ€ Ð³Ð¾Ñ€Ð¾Ð´Ð° Ð Ð¾ÑÑÐ¸Ð¸">
              <label className="city-search">
                <span aria-hidden="true">âŒ•</span>
                <input autoFocus value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} placeholder="ÐÐ°Ð¹Ñ‚Ð¸ Ð³Ð¾Ñ€Ð¾Ð´" aria-label="ÐŸÐ¾Ð¸ÑÐº Ð³Ð¾Ñ€Ð¾Ð´Ð° Ð Ð¾ÑÑÐ¸Ð¸" />
              </label>
              <small className="city-menu-caption">{cityQuery.trim().length >= 2 ? "Ð ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚Ñ‹ Ð¿Ð¾Ð¸ÑÐºÐ°" : "ÐŸÐ¾Ð¿ÑƒÐ»ÑÑ€Ð½Ñ‹Ðµ Ð³Ð¾Ñ€Ð¾Ð´Ð°"}</small>
              <div className="city-results">
                {(cityQuery.trim().length >= 2 ? cityResults : popularCities).map((item) => (
                  <button type="button" key={`${item.name}-${item.center.join("-")}`} onClick={() => chooseCity(item)}>
                    <span>{item.name}</span><small>{item.region || "Ð Ð¾ÑÑÐ¸Ñ"}</small>
                  </button>
                ))}
                {citySearchState === "loading" && <p>Ð˜Ñ‰ÐµÐ¼ Ð¿Ð¾ Ð²ÑÐµÐ¹ Ð Ð¾ÑÑÐ¸Ð¸â€¦</p>}
                {citySearchState === "error" && <p>ÐŸÐ¾Ð¸ÑÐº Ð²Ñ€ÐµÐ¼ÐµÐ½Ð½Ð¾ Ð½ÐµÐ´Ð¾ÑÑ‚ÑƒÐ¿ÐµÐ½</p>}
                {citySearchState === "idle" && cityQuery.trim().length >= 2 && cityResults.length === 0 && <p>Ð“Ð¾Ñ€Ð¾Ð´ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½</p>}
              </div>
            </div>
          )}
        </div>
        <button type="button" className="locate-button" onClick={locateMe}><Icon>âž¤</Icon>Ð£Ñ‚Ð¾Ñ‡Ð½Ð¸Ñ‚ÑŒ</button>
      </div>

      <div className="map-status-card" aria-live="polite">
        <span className="live-dot" />
        <div>
          <strong>{sourceState === "loading" ? "Ð—Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ ÐÐ—Ð¡â€¦" : `${city.nationwide ? sourceTotal : filteredStations.length} ÐÐ—Ð¡ Ð½Ð° ÐºÐ°Ñ€Ñ‚Ðµ`}</strong>
          <small>{sourceState === "live" ? `${city.nationwide ? "Ð’ÑÐµ Ñ‚Ð¾Ñ‡ÐºÐ¸ Ð“Ð´ÐµÐ‘Ð•ÐÐ—" : "Ð”Ð°Ð½Ð½Ñ‹Ðµ Ð“Ð´ÐµÐ‘Ð•ÐÐ—"}${sourceUpdated ? ` Â· ${sourceUpdated}` : ""}` : sourceState === "fallback" ? "Ð˜ÑÑ‚Ð¾Ñ‡Ð½Ð¸Ðº Ð´Ð°Ð½Ð½Ñ‹Ñ… Ð²Ñ€ÐµÐ¼ÐµÐ½Ð½Ð¾ Ð½ÐµÐ´Ð¾ÑÑ‚ÑƒÐ¿ÐµÐ½" : "ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ Ð°ÐºÑ‚ÑƒÐ°Ð»ÑŒÐ½Ñ‹Ðµ Ð¾Ñ‚Ð¼ÐµÑ‚ÐºÐ¸"}</small>
        </div>
      </div>

      {geoStatus && <div className="geo-toast" role="status">{geoStatus}</div>}

      {panel && (
        <section className="map-panel" aria-labelledby="map-panel-title">
          <div className="map-panel-head">
            <div>
              <small>{panel === "saved" ? "Ð¡Ð¾Ñ…Ñ€Ð°Ð½Ñ‘Ð½Ð½Ñ‹Ðµ" : panel === "pick" ? "Ð£Ð¼Ð½Ñ‹Ð¹ Ð¿Ð¾Ð´Ð±Ð¾Ñ€" : "Ð ÑÐ´Ð¾Ð¼ Ñ Ð²Ð°Ð¼Ð¸"}</small>
              <h1 id="map-panel-title">{panel === "saved" ? "Ð—Ð°ÐºÐ»Ð°Ð´ÐºÐ¸" : panel === "pick" ? "ÐšÐ°Ðº Ð¿Ð¾Ð´Ð¾Ð±Ñ€Ð°Ñ‚ÑŒ ÐÐ—Ð¡?" : "Ð—Ð°Ð¿Ñ€Ð°Ð²ÐºÐ¸ Ñ€ÑÐ´Ð¾Ð¼"}</h1>
            </div>
            <button type="button" onClick={() => setPanel(null)} aria-label="Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ Ð¿Ð°Ð½ÐµÐ»ÑŒ">Ã—</button>
          </div>
          {panel === "pick" ? (
            <div className="pick-options">
              <button type="button" onClick={pickBest}><Icon>âŒ–</Icon><span><strong>ÐŸÐ¾Ð±Ñ‹ÑÑ‚Ñ€ÐµÐµ</strong><small>Ð¡Ð°Ð¼Ð°Ñ ÑÐ²ÐµÐ¶Ð°Ñ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒÑÐºÐ°Ñ Ð¾Ñ‚Ð¼ÐµÑ‚ÐºÐ°</small></span><b>â†’</b></button>
              <button type="button" onClick={() => { const first = filteredStations[0]; if (first) selectStation(first); setPanel(null); }}><Icon>â†—</Icon><span><strong>ÐŸÐ¾Ð±Ð»Ð¸Ð¶Ðµ</strong><small>ÐŸÐµÑ€Ð²Ð°Ñ Ð¿Ð¾Ð´Ñ…Ð¾Ð´ÑÑ‰Ð°Ñ Ñ‚Ð¾Ñ‡ÐºÐ° Ð½Ð° ÐºÐ°Ñ€Ñ‚Ðµ</small></span><b>â†’</b></button>
              <p>ÐŸÐ¾Ð´Ð±Ð¾Ñ€ Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÑ‚ Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ñ‹Ðµ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒÑÐºÐ¸Ðµ Ð¾Ñ‚Ð¼ÐµÑ‚ÐºÐ¸ Â«Ð“Ð´ÐµÐ‘Ð•ÐÐ—Â». ÐŸÐµÑ€ÐµÐ´ Ð¿Ð¾ÐµÐ·Ð´ÐºÐ¾Ð¹ Ð¿ÐµÑ€ÐµÐ¿Ñ€Ð¾Ð²ÐµÑ€ÑŒÑ‚Ðµ Ð½Ð°Ð»Ð¸Ñ‡Ð¸Ðµ Ñ‚Ð¾Ð¿Ð»Ð¸Ð²Ð°.</p>
            </div>
          ) : visibleInPanel.length ? (
            <div className="station-list">
              {visibleInPanel.map((station) => (
                <button type="button" key={station.id} onClick={() => selectStation(station)}>
                  <span className={`list-status ${station.status}`} />
                  <span><strong>{station.name}</strong><small>{station.address}</small><em>{station.fuels.join(" Â· ")}</em></span>
                  <span className="station-meta"><b>{station.confirmations ? `${station.confirmations} Ð¿Ð¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´.` : statusText[station.status]}</b><small>{station.updated < 0 ? "Ð¾Ð±Ñ‰Ð°Ñ ÐºÐ°Ñ€Ñ‚Ð°" : `${station.updated} Ð¼Ð¸Ð½ Ð½Ð°Ð·Ð°Ð´`}</small></span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-panel"><span>â—‡</span><strong>ÐŸÐ¾ÐºÐ° Ð¿ÑƒÑÑ‚Ð¾</strong><p>{panel === "saved" ? "Ð”Ð¾Ð±Ð°Ð²ÑŒÑ‚Ðµ ÐÐ—Ð¡ Ð² Ð·Ð°ÐºÐ»Ð°Ð´ÐºÐ¸ Ð¸Ð· ÐºÐ°Ñ€Ñ‚Ð¾Ñ‡ÐºÐ¸ Ñ‚Ð¾Ñ‡ÐºÐ¸." : "Ð˜Ð·Ð¼ÐµÐ½Ð¸Ñ‚Ðµ Ñ„Ð¸Ð»ÑŒÑ‚Ñ€Ñ‹, Ñ‡Ñ‚Ð¾Ð±Ñ‹ ÑƒÐ²Ð¸Ð´ÐµÑ‚ÑŒ Ð±Ð¾Ð»ÑŒÑˆÐµ Ñ‚Ð¾Ñ‡ÐµÐº."}</p></div>
          )}
        </section>
      )}

      {selected && (
        <article className="station-detail" aria-label={`Ð’Ñ‹Ð±Ñ€Ð°Ð½Ð° ${selected.name}`}>
          <button type="button" className="detail-close" onClick={() => setSelectedId(null)} aria-label="Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ ÐºÐ°Ñ€Ñ‚Ð¾Ñ‡ÐºÑƒ">Ã—</button>
          <div className="detail-title">
            <div><small>{selected.network}</small><h2>{selected.name}</h2><p>{selected.address}</p></div>
            <button type="button" onClick={() => toggleSaved(selected.id)} aria-pressed={saved.has(selected.id)} aria-label={saved.has(selected.id) ? "Ð£Ð±Ñ€Ð°Ñ‚ÑŒ Ð¸Ð· Ð·Ð°ÐºÐ»Ð°Ð´Ð¾Ðº" : "Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ Ð² Ð·Ð°ÐºÐ»Ð°Ð´ÐºÐ¸"}>{saved.has(selected.id) ? "â™¥" : "â™¡"}</button>
          </div>
          <div className="detail-status"><span className={selected.status}>{statusText[selected.status]}</span><b>{selected.confirmations ? `ÐŸÐ¾Ð´Ñ‚Ð²ÐµÑ€Ð¶Ð´ÐµÐ½Ð¸Ð¹ Â· ${selected.confirmations}` : selected.queue ? `ÐžÑ‡ÐµÑ€ÐµÐ´ÑŒ Â· ${selected.queue} Ð°Ð²Ñ‚Ð¾` : "Ð¡Ñ‚Ð°Ñ‚ÑƒÑ Ñ‚Ð¾Ñ‡ÐºÐ¸"}</b></div>
          <div className="detail-fuels">{selected.fuels.map((item) => <span key={item} className={item === fuel ? "active" : ""}>{item}</span>)}</div>
          <div className="detail-freshness"><span><i style={{ width: selected.confidence === "Ð’Ñ‹ÑÐ¾ÐºÐ°Ñ" ? "90%" : selected.confidence === "Ð¡Ñ€ÐµÐ´Ð½ÑÑ" ? "58%" : "28%" }} /></span><small>{selected.updated < 0 ? "ÐžÐ±Ð·Ð¾Ñ€Ð½Ð°Ñ Ñ‚Ð¾Ñ‡ÐºÐ° Â· Ð¾Ñ‚ÐºÑ€Ð¾Ð¹Ñ‚Ðµ Ð³Ð¾Ñ€Ð¾Ð´ Ð´Ð»Ñ ÑÐ²ÐµÐ¶ÐµÐ³Ð¾ ÑÑ‚Ð°Ñ‚ÑƒÑÐ°" : `${selected.confidence} ÑƒÐ²ÐµÑ€ÐµÐ½Ð½Ð¾ÑÑ‚ÑŒ Â· ${selected.updated} Ð¼Ð¸Ð½ Ð½Ð°Ð·Ð°Ð´`}</small></div>
          <a href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${selected.coords[0]},${selected.coords[1]}`} target="_blank" rel="noreferrer">ÐŸÐ¾ÑÑ‚Ñ€Ð¾Ð¸Ñ‚ÑŒ Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚ <span>â†—</span></a>
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


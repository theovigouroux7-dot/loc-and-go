"use client";

import { createStore, del, get, set, clear } from "idb-keyval";
import { uid } from "./utils";

// Les photos sont stockées dans IndexedDB (le localStorage est limité à quelques Mo).
const store = typeof indexedDB !== "undefined" ? createStore("loc-and-go", "photos") : undefined;

const MAX_SIDE = 1280;
const QUALITY = 0.72;

/** Réduit une photo prise au téléphone et l'enregistre. Renvoie son identifiant. */
export async function savePhoto(file: File): Promise<string> {
  const dataUrl = await resizeImage(file);
  const id = uid("ph");
  if (store) await set(id, dataUrl, store);
  return id;
}

export async function loadPhoto(id: string): Promise<string | undefined> {
  if (!store) return undefined;
  return get<string>(id, store);
}

export async function deletePhoto(id: string): Promise<void> {
  if (store) await del(id, store);
}

export async function clearPhotos(): Promise<void> {
  if (store) await clear(store);
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponible"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

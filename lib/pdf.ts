"use client";

import type { Module } from "./types";
import { moduleUrl } from "./utils";

// Planche A4 portrait : 3 colonnes × 4 lignes = 12 plaques, avec traits de coupe.
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 10;
const COLS = 3;
const ROWS = 4;

/** Génère et télécharge le PDF des plaques QR code des modules donnés. */
export async function downloadPlaquesPdf(modules: Module[], nomLoueur: string): Promise<void> {
  const [{ jsPDF }, QRCode] = await Promise.all([import("jspdf"), import("qrcode")]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const cellW = (PAGE_W - 2 * MARGIN) / COLS;
  const cellH = (PAGE_H - 2 * MARGIN) / ROWS;
  const qrSize = 36;
  const perPage = COLS * ROWS;

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    const pos = i % perPage;
    if (i > 0 && pos === 0) doc.addPage();
    const col = pos % COLS;
    const row = Math.floor(pos / COLS);
    const x = MARGIN + col * cellW;
    const y = MARGIN + row * cellH;
    const cx = x + cellW / 2;

    // Trait de coupe en pointillés.
    doc.setDrawColor(190);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.rect(x, y, cellW, cellH);
    doc.setLineDashPattern([], 0);

    // Cadre de la plaque.
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.roundedRect(x + 4, y + 4, cellW - 8, cellH - 8, 3, 3);

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(nomLoueur.toUpperCase().slice(0, 40), cx, y + 11, { align: "center" });

    const png = await QRCode.toDataURL(moduleUrl(m.id), { margin: 1, width: 600, errorCorrectionLevel: "M" });
    doc.addImage(png, "PNG", cx - qrSize / 2, y + 14, qrSize, qrSize);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(m.numero, cx, y + 14 + qrSize + 7, { align: "center" });

    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("Scannez : contrat, SAV, retour", cx, y + 14 + qrSize + 12, { align: "center" });
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`plaques-qr-${date}.pdf`);
}

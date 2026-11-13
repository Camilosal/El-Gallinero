import { NTC1240_GRADES } from "@/lib/ntc1240";

export type Ruta2DeliverableType =
  | "zonificacion"
  | "guia-galpon"
  | "compostaje-poe"
  | "acta-entrega";

export interface ZonificationLocationRow {
  code: string;
  name: string;
  type: string;
  zoneType: string;
  allowedSpecies: string[];
  capacity: number | null;
  sanitaryStatus: string;
  sanitaryEmptyUntil: string | null;
  isQuarantine: boolean;
}

export interface ZonificationMapPdfData {
  farmName: string;
  municipality: string;
  altitudeMeters: string;
  generatedAt: string;
  locations: ZonificationLocationRow[];
  hasMixedSpeciesConflict: boolean;
  mixedLocations: string[];
  hasQuarantineZone: boolean;
  hasCompostZone: boolean;
  correctiveActions: string[];
}

export interface WithdrawalLockSummary {
  date: string;
  type: string;
  product: string;
  species: string | null;
  locationName: string | null;
  batchCode: string | null;
  withdrawalUntilDate: string;
}

export interface BarnQuickGuidePdfData {
  farmName: string;
  municipality: string;
  generatedAt: string;
  activeWithdrawals: WithdrawalLockSummary[];
}

export interface CompostingPileSummary {
  code: string;
  name: string;
  formulaRatio: string;
  startDate: string;
  currentTempC: string | null;
  moisturePct: string | null;
  turnCount: number;
  nextTurnDueDate: string | null;
  expectedHarvestDate: string | null;
  status: string;
  locationName: string | null;
}

export interface CompostingPoePdfData {
  farmName: string;
  municipality: string;
  generatedAt: string;
  piles: CompostingPileSummary[];
  recentBiosecurityCount30d: number;
  sanitaryEmptyDaysRequired: number;
}

export interface WeekStatusItem {
  week: number;
  title: string;
  status: "completado" | "en_progreso" | "pendiente";
  evidence: string;
}

export interface TeamRoleMember {
  name: string;
  username: string;
  role: string;
  roleLabel: string;
  keyPermissions: string;
}

export interface SpeciesCensusRow {
  species: string;
  label: string;
  count: number;
}

export interface Week4HandoverActPdfData {
  farmName: string;
  municipality: string;
  altitudeMeters: string;
  scale: string;
  planCode: string;
  generatedAt: string;
  periodFrom: string;
  periodTo: string;
  roadmap: WeekStatusItem[];
  team: TeamRoleMember[];
  census: SpeciesCensusRow[];
  totalLiveAnimals: number;
  lastClosure: {
    closureDate: string;
    status: string;
    closedByName: string | null;
    eggsCollected: number;
    mortalityCount: number;
    dayIncome: number;
    dayExpense: number;
  } | null;
  unitEconomics: {
    directRevenue: number;
    directCost: number;
    proratedCost: number;
    totalCost: number;
    netProfit: number;
    realCostPerEgg: number;
    realCostPerTray30: number;
    avgSalePricePerEgg: number;
    eggBreakevenAlert: boolean;
    realCostPerLiveKg: number;
    realCostPerCarcassKg: number;
    avgMeatSalePricePerKg: number;
    meatBreakevenAlert: boolean;
  };
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_LIMIT = 48;

type Rgb = [number, number, number];

const COLOR_DARK_EMERALD: Rgb = [0.024, 0.306, 0.231]; // #064e3b
const COLOR_SLATE_900: Rgb = [0.059, 0.09, 0.165];
const COLOR_SLATE_600: Rgb = [0.278, 0.333, 0.412];
const COLOR_SLATE_200: Rgb = [0.886, 0.91, 0.941];
const COLOR_SLATE_50: Rgb = [0.973, 0.98, 0.988];
const COLOR_WHITE: Rgb = [1, 1, 1];

const TONE_PALETTE: Record<"ok" | "warn" | "danger", { bg: Rgb; border: Rgb; text: Rgb }> = {
  ok: { bg: [0.925, 0.992, 0.961], border: [0.02, 0.588, 0.412], text: [0.024, 0.373, 0.275] },
  warn: { bg: [1, 0.984, 0.922], border: [0.851, 0.467, 0.024], text: [0.573, 0.251, 0.055] },
  danger: { bg: [0.996, 0.949, 0.949], border: [0.863, 0.149, 0.149], text: [0.6, 0.106, 0.106] },
};

function sanitizeToWinAnsi(input: string): string {
  const replaced = String(input ?? "")
    .replaceAll("≥", ">=")
    .replaceAll("≤", "<=")
    .replaceAll("→", "->")
    .replaceAll("←", "<-")
    .replaceAll("≈", "~")
    .replaceAll("✓", "[OK]")
    .replaceAll("✔", "[OK]")
    .replaceAll("✕", "[X]")
    .replaceAll("✗", "[X]")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("•", "*")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("‘", "'")
    .replaceAll("’", "'")
    .replaceAll("…", "...");

  let out = "";
  for (let i = 0; i < replaced.length; i++) {
    const code = replaced.charCodeAt(i);
    if (code === 10 || code === 13 || code === 9) {
      out += " ";
    } else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      out += replaced[i];
    }
  }
  return out;
}

function pdfEscape(raw: string): string {
  return sanitizeToWinAnsi(raw)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = sanitizeToWinAnsi(text).replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const limit = Math.max(8, maxChars);
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > limit) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += limit) {
        lines.push(word.slice(i, i + limit));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatCop(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}$${abs}`;
}

class PdfDocumentBuilder {
  private pages: string[][] = [];
  private cursorY = PAGE_H - MARGIN;
  private docTitle: string;
  private docSubtitle: string;
  private metaRight: string;
  private generatedAt: string;

  constructor(docTitle: string, docSubtitle: string, metaRight: string, generatedAt: string) {
    this.docTitle = docTitle;
    this.docSubtitle = docSubtitle;
    this.metaRight = metaRight;
    this.generatedAt = generatedAt;
    this.startPage(true);
  }

  private currentOps(): string[] {
    return this.pages[this.pages.length - 1];
  }

  private startPage(firstPage: boolean) {
    this.pages.push([]);
    const bannerH = firstPage ? 56 : 38;
    const bannerBottom = PAGE_H - MARGIN - bannerH;
    this.drawRectRaw(MARGIN, bannerBottom, CONTENT_W, bannerH, COLOR_DARK_EMERALD);

    if (firstPage) {
      this.drawTextRaw(MARGIN + 14, PAGE_H - MARGIN - 16, "IWAGE GRANJA · RUTA 2 LLAVE EN MANO", {
        size: 7.5,
        bold: true,
        color: [0.655, 0.953, 0.816],
      });
      this.drawTextRaw(MARGIN + 14, PAGE_H - MARGIN - 31, this.docTitle, {
        size: 13.5,
        bold: true,
        color: COLOR_WHITE,
      });
      this.drawTextRaw(MARGIN + 14, PAGE_H - MARGIN - 45, this.docSubtitle, {
        size: 8.5,
        bold: false,
        color: [0.88, 0.97, 0.93],
      });
      this.drawTextRaw(PAGE_W - MARGIN - 150, PAGE_H - MARGIN - 18, this.metaRight, {
        size: 8,
        bold: false,
        color: [0.85, 0.96, 0.91],
      });
    } else {
      this.drawTextRaw(MARGIN + 14, PAGE_H - MARGIN - 23, `${this.docTitle} (continuación)`, {
        size: 11,
        bold: true,
        color: COLOR_WHITE,
      });
    }

    this.cursorY = bannerBottom - 14;
  }

  ensureSpace(neededPts: number) {
    if (this.cursorY - neededPts < FOOTER_LIMIT) {
      this.startPage(false);
    }
  }

  private drawRectRaw(
    x: number,
    bottomY: number,
    w: number,
    h: number,
    fill?: Rgb,
    stroke?: Rgb,
    lineWidth = 0.7,
  ) {
    const ops = this.currentOps();
    ops.push("q");
    if (fill) ops.push(`${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg`);
    if (stroke) {
      ops.push(`${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG`);
      ops.push(`${lineWidth.toFixed(2)} w`);
    }
    ops.push(`${x.toFixed(2)} ${bottomY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    if (fill && stroke) ops.push("B");
    else if (fill) ops.push("f");
    else ops.push("S");
    ops.push("Q");
  }

  private drawLineRaw(x1: number, y1: number, x2: number, y2: number, stroke: Rgb = COLOR_SLATE_200, width = 0.6) {
    const ops = this.currentOps();
    ops.push(
      `q ${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`,
    );
  }

  private drawTextRaw(
    x: number,
    y: number,
    text: string,
    opts?: { size?: number; bold?: boolean; color?: Rgb },
  ) {
    const size = opts?.size ?? 9.5;
    const font = opts?.bold ? "/F2" : "/F1";
    const color = opts?.color ?? COLOR_SLATE_900;
    const escaped = pdfEscape(text);
    this.currentOps().push(
      `BT ${font} ${size.toFixed(1)} Tf ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escaped}) Tj ET`,
    );
  }

  drawSectionTitle(title: string) {
    this.ensureSpace(24);
    this.cursorY -= 4;
    this.drawLineRaw(MARGIN, this.cursorY - 12, PAGE_W - MARGIN, this.cursorY - 12, COLOR_DARK_EMERALD, 1.1);
    this.drawTextRaw(MARGIN, this.cursorY - 8, title, {
      size: 10.5,
      bold: true,
      color: COLOR_DARK_EMERALD,
    });
    this.cursorY -= 20;
  }

  drawParagraph(text: string, size = 8.8, bold = false, color: Rgb = COLOR_SLATE_900) {
    const lines = wrapText(text, Math.floor(CONTENT_W / (size * 0.52)));
    const lineH = size + 3.2;
    for (const line of lines) {
      this.ensureSpace(lineH + 2);
      this.drawTextRaw(MARGIN, this.cursorY - size, line, { size, bold, color });
      this.cursorY -= lineH;
    }
    this.cursorY -= 4;
  }

  drawKeyValueGrid(pairs: { label: string; value: string }[], cols = 3) {
    const gap = 8;
    const boxW = (CONTENT_W - gap * (cols - 1)) / cols;
    const boxH = 34;

    for (let i = 0; i < pairs.length; i += cols) {
      this.ensureSpace(boxH + 6);
      const rowItems = pairs.slice(i, i + cols);
      const bottomY = this.cursorY - boxH;
      rowItems.forEach((item, colIdx) => {
        const x = MARGIN + colIdx * (boxW + gap);
        this.drawRectRaw(x, bottomY, boxW, boxH, COLOR_SLATE_50, COLOR_SLATE_200, 0.7);
        this.drawTextRaw(x + 8, bottomY + boxH - 12, item.label.slice(0, 34), {
          size: 7.4,
          bold: false,
          color: COLOR_SLATE_600,
        });
        const valLines = wrapText(item.value, Math.floor((boxW - 14) / (9.5 * 0.54)));
        this.drawTextRaw(x + 8, bottomY + 9, (valLines[0] || "-").slice(0, 38), {
          size: 9.5,
          bold: true,
          color: COLOR_SLATE_900,
        });
      });
      this.cursorY = bottomY - 7;
    }
  }

  drawAlertBox(title: string, lines: string[], tone: "ok" | "warn" | "danger") {
    const palette = TONE_PALETTE[tone];
    const wrapped: string[] = [];
    const maxChars = Math.floor((CONTENT_W - 22) / (8.4 * 0.52));
    for (const line of lines) {
      wrapped.push(...wrapText(line, maxChars));
    }
    const lineH = 11.5;
    const boxH = 22 + Math.max(1, wrapped.length) * lineH + 6;
    this.ensureSpace(boxH + 6);
    const bottomY = this.cursorY - boxH;

    this.drawRectRaw(MARGIN, bottomY, CONTENT_W, boxH, palette.bg, palette.border, 1.0);
    this.drawTextRaw(MARGIN + 10, bottomY + boxH - 14, title, {
      size: 9.4,
      bold: true,
      color: palette.text,
    });

    let textY = bottomY + boxH - 27;
    for (const wLine of wrapped) {
      this.drawTextRaw(MARGIN + 10, textY, wLine, {
        size: 8.3,
        bold: false,
        color: COLOR_SLATE_900,
      });
      textY -= lineH;
    }

    this.cursorY = bottomY - 8;
  }

  drawStepGrid(steps: { num: string; title: string; detail: string }[]) {
    const gap = 8;
    const boxW = (CONTENT_W - gap) / 2;
    const boxH = 54;
    for (let i = 0; i < steps.length; i += 2) {
      this.ensureSpace(boxH + 8);
      const pair = steps.slice(i, i + 2);
      const bottomY = this.cursorY - boxH;
      pair.forEach((step, idx) => {
        const x = MARGIN + idx * (boxW + gap);
        this.drawRectRaw(x, bottomY, boxW, boxH, COLOR_SLATE_50, COLOR_SLATE_200, 0.8);
        this.drawTextRaw(x + 8, bottomY + boxH - 14, `${step.num}. ${step.title}`, {
          size: 9,
          bold: true,
          color: COLOR_DARK_EMERALD,
        });
        const lines = wrapText(step.detail, Math.floor((boxW - 16) / (8 * 0.52))).slice(0, 3);
        let ly = bottomY + boxH - 26;
        for (const l of lines) {
          this.drawTextRaw(x + 8, ly, l, { size: 8, color: COLOR_SLATE_900 });
          ly -= 10;
        }
      });
      this.cursorY = bottomY - 7;
    }
  }

  drawTable(headers: string[], rows: string[][], colRatios: number[], fontSize = 8) {
    const totalRatio = colRatios.reduce((s, r) => s + r, 0);
    const colWidths = colRatios.map((r) => (r / totalRatio) * CONTENT_W);
    const headerH = 20;

    const drawHeader = () => {
      this.ensureSpace(headerH + 18);
      const bottomY = this.cursorY - headerH;
      this.drawRectRaw(MARGIN, bottomY, CONTENT_W, headerH, COLOR_DARK_EMERALD);
      let x = MARGIN;
      headers.forEach((h, idx) => {
        const maxCh = Math.floor((colWidths[idx] - 8) / (fontSize * 0.56));
        this.drawTextRaw(x + 4, bottomY + 6, h.slice(0, Math.max(4, maxCh)), {
          size: fontSize,
          bold: true,
          color: COLOR_WHITE,
        });
        x += colWidths[idx];
      });
      this.cursorY = bottomY;
    };

    drawHeader();

    if (rows.length === 0) {
      const emptyH = 22;
      this.ensureSpace(emptyH + 4);
      const bottomY = this.cursorY - emptyH;
      this.drawRectRaw(MARGIN, bottomY, CONTENT_W, emptyH, COLOR_WHITE, COLOR_SLATE_200, 0.5);
      this.drawTextRaw(MARGIN + 8, bottomY + 7, "Sin registros para este bloque a la fecha de corte.", {
        size: fontSize,
        color: COLOR_SLATE_600,
      });
      this.cursorY = bottomY - 8;
      return;
    }

    rows.forEach((row, rowIdx) => {
      const cellLines = row.map((cell, colIdx) => {
        const maxChars = Math.max(6, Math.floor((colWidths[colIdx] - 8) / (fontSize * 0.54)));
        return wrapText(cell || "-", maxChars).slice(0, 3);
      });
      const maxLineCount = Math.max(1, ...cellLines.map((l) => l.length));
      const rowH = Math.max(18, 6 + maxLineCount * (fontSize + 2.2));

      if (this.cursorY - rowH < FOOTER_LIMIT) {
        this.startPage(false);
        drawHeader();
      }

      const bottomY = this.cursorY - rowH;
      const bg = rowIdx % 2 === 1 ? COLOR_SLATE_50 : COLOR_WHITE;
      this.drawRectRaw(MARGIN, bottomY, CONTENT_W, rowH, bg, COLOR_SLATE_200, 0.4);

      let x = MARGIN;
      cellLines.forEach((lines, colIdx) => {
        let ty = this.cursorY - 11;
        for (const line of lines) {
          this.drawTextRaw(x + 4, ty, line, {
            size: fontSize,
            bold: false,
            color: COLOR_SLATE_900,
          });
          ty -= fontSize + 2;
        }
        x += colWidths[colIdx];
      });

      this.cursorY = bottomY;
    });

    this.cursorY -= 8;
  }

  drawSignatureRow(roles: string[]) {
    const boxH = 54;
    this.ensureSpace(boxH + 10);
    const gap = 10;
    const cols = roles.length;
    const boxW = (CONTENT_W - gap * (cols - 1)) / cols;
    const bottomY = this.cursorY - boxH;

    roles.forEach((roleTitle, idx) => {
      const x = MARGIN + idx * (boxW + gap);
      this.drawRectRaw(x, bottomY, boxW, boxH, COLOR_WHITE, COLOR_SLATE_200, 0.7);
      this.drawLineRaw(x + 10, bottomY + 22, x + boxW - 10, bottomY + 22, COLOR_SLATE_600, 0.7);
      this.drawTextRaw(x + 10, bottomY + 10, roleTitle, {
        size: 7.8,
        bold: true,
        color: COLOR_SLATE_900,
      });
    });

    this.cursorY = bottomY - 8;
  }

  buildBuffer(): Buffer {
    const totalPages = this.pages.length;

    // Agregar pie de página a todas las páginas antes de serializar
    this.pages.forEach((ops, idx) => {
      const footerLine = `Iwage Granja · Ruta 2 Llave en Mano | Fecha: ${this.generatedAt} | Pag. ${idx + 1} de ${totalPages}`;
      ops.push(
        `q ${COLOR_SLATE_200[0].toFixed(3)} ${COLOR_SLATE_200[1].toFixed(3)} ${COLOR_SLATE_200[2].toFixed(3)} RG 0.6 w ${MARGIN} ${FOOTER_LIMIT - 12} m ${PAGE_W - MARGIN} ${FOOTER_LIMIT - 12} l S Q`,
      );
      ops.push(
        `BT /F1 7.5 Tf ${COLOR_SLATE_600[0].toFixed(3)} ${COLOR_SLATE_600[1].toFixed(3)} ${COLOR_SLATE_600[2].toFixed(3)} rg 1 0 0 1 ${MARGIN} ${FOOTER_LIMIT - 23} Tm (${pdfEscape(footerLine)}) Tj ET`,
      );
    });

    const objects: string[] = [];
    // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold
    const pageObjIds: number[] = [];
    let nextId = 5;

    const pageEntries: { pageId: number; contentId: number; stream: string }[] = [];
    for (const ops of this.pages) {
      const contentId = nextId++;
      const pageId = nextId++;
      pageObjIds.push(pageId);
      pageEntries.push({
        pageId,
        contentId,
        stream: ops.join("\n"),
      });
    }

    objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    objects.push(
      `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>\nendobj\n`,
    );
    objects.push(
      "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
    );
    objects.push(
      "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
    );

    const dynamicObjects: { id: number; body: string }[] = [];
    for (const entry of pageEntries) {
      dynamicObjects.push({
        id: entry.contentId,
        body: `${entry.contentId} 0 obj\n<< /Length ${entry.stream.length} >>\nstream\n${entry.stream}\nendstream\nendobj\n`,
      });
      dynamicObjects.push({
        id: entry.pageId,
        body: `${entry.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${entry.contentId} 0 R >>\nendobj\n`,
      });
    }
    dynamicObjects.sort((a, b) => a.id - b.id);
    for (const d of dynamicObjects) objects.push(d.body);

    const header = "%PDF-1.4\n";
    const offsets: number[] = [0];
    let currentOffset = header.length;
    const chunks: string[] = [header];

    for (const obj of objects) {
      offsets.push(currentOffset);
      chunks.push(obj);
      currentOffset += obj.length;
    }

    const xrefStart = currentOffset;
    const totalObjects = offsets.length;
    let xref = `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
      xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    return Buffer.from(chunks.join("") + xref + trailer, "latin1");
  }
}

export function buildZonificationMapPdf(data: ZonificationMapPdfData): Buffer {
  const doc = new PdfDocumentBuilder(
    "Mapa Digital de Zonificación Biosegura y Matriz ICA",
    `Semana 1 · Predio: ${data.farmName} (${data.municipality})`,
    `Corte: ${data.generatedAt}`,
    data.generatedAt,
  );

  const totalCap = data.locations.reduce((s, l) => s + Number(l.capacity || 0), 0);
  const quarantineCount = data.locations.filter((l) => l.isQuarantine || l.zoneType === "cuarentena").length;
  const speciesSet = new Set<string>();
  data.locations.forEach((l) => l.allowedSpecies.forEach((sp) => speciesSet.add(sp)));

  doc.drawKeyValueGrid(
    [
      { label: "Predio / Municipio", value: `${data.farmName} (${data.municipality})` },
      { label: "Altitud registrada", value: data.altitudeMeters ? `${data.altitudeMeters} msnm` : "Sin registrar" },
      { label: "Lugares activos / Cap.", value: `${data.locations.length} lugares · Cap. ${totalCap}` },
      { label: "Zonas cuarentena", value: quarantineCount > 0 ? `${quarantineCount} habilitada(s)` : "Sin cuarentena" },
      { label: "Especies configuradas", value: speciesSet.size > 0 ? Array.from(speciesSet).join(", ") : "Sin definir" },
      { label: "Aislamiento aves/mamíf.", value: data.hasMixedSpeciesConflict ? "ALERTA DE MEZCLA" : "Aislamiento correcto" },
    ],
    3,
  );

  doc.drawSectionTitle("1. Verificación Normativa ICA / MADR 205 de 2022");
  if (data.hasMixedSpeciesConflict) {
    doc.drawAlertBox(
      "Alerta de Bioseguridad: Mezcla incompatible aves vs. mamíferos",
      [
        `Lugares con especies mixtas incompatibles: ${data.mixedLocations.join(", ")}.`,
        "Res. MADR 205/2022 e ICA 3650-3652 exigen separación física estricta entre aves (gallina, pollo, codorniz, pato) y mamíferos (conejo, cuy).",
      ],
      "danger",
    );
  } else if (!data.hasQuarantineZone || !data.hasCompostZone) {
    doc.drawAlertBox(
      "Observación de Zonificación: Áreas de apoyo incompletas",
      [
        data.hasQuarantineZone ? "[OK] Cuenta con área de cuarentena." : "- Falta registrar al menos 1 área de cuarentena para aves nuevas o enfermas.",
        data.hasCompostZone ? "[OK] Cuenta con zona de compostaje." : "- Falta registrar zona de compostaje (Res. ICA 30292/2017).",
      ],
      "warn",
    );
  } else {
    doc.drawAlertBox(
      "Matriz de Zonificación Biosegura Aprobada en Sistema",
      [
        "Aislamiento físico entre especies compatible según Res. MADR 205/2022 y Res. ICA 3650-3652.",
        "Cuenta con área de cuarentena y zona de compostaje activas dentro del predio.",
      ],
      "ok",
    );
  }

  doc.drawSectionTitle("2. Inventario por Zonas Bioseguras del Predio");
  const sortedLocations = [...data.locations].sort((a, b) => a.zoneType.localeCompare(b.zoneType) || a.code.localeCompare(b.code));
  doc.drawTable(
    ["Código", "Lugar", "Zona", "Tipo", "Especies permitidas", "Cap.", "Estado sanitario"],
    sortedLocations.map((l) => [
      l.code,
      l.name,
      l.isQuarantine ? "CUARENTENA" : l.zoneType.toUpperCase(),
      l.type,
      l.allowedSpecies.length > 0 ? l.allowedSpecies.join(", ") : "Sin restringir",
      l.capacity != null ? String(l.capacity) : "-",
      l.sanitaryEmptyUntil ? `${l.sanitaryStatus} (vacío: ${l.sanitaryEmptyUntil})` : l.sanitaryStatus,
    ]),
    [0.9, 1.5, 1.0, 0.85, 1.45, 0.55, 1.45],
    7.6,
  );

  doc.drawSectionTitle("3. Plan de Acciones Correctivas Recomendadas");
  if (data.correctiveActions.length === 0) {
    doc.drawParagraph("Sin acciones correctivas urgentes. Mantén la revisión sanitaria periódica y el cierre diario en campo.");
  } else {
    data.correctiveActions.forEach((act, idx) => {
      doc.drawParagraph(`${idx + 1}. ${act}`);
    });
  }

  return doc.buildBuffer();
}

export function buildBarnQuickGuidePdf(data: BarnQuickGuidePdfData): Buffer {
  const doc = new PdfDocumentBuilder(
    "Guía Rápida de Galpón Plastificable (Operación < 2 min)",
    `Kit 7.2 · ${data.farmName} (${data.municipality})`,
    `Vigencia: ${data.generatedAt}`,
    data.generatedAt,
  );

  doc.drawSectionTitle("1. Flujo Diario de Campo (< 2 min · Funciona sin internet)");
  doc.drawStepGrid([
    {
      num: "Paso 1",
      title: "Escanear placa QR en puerta",
      detail: "Abre 'Escáner QR' en el celular, apunta a la placa plastificada del galpón o lote para cargar contexto sin digitar.",
    },
    {
      num: "Paso 2",
      title: "Registrar huevos o bultos (40 kg)",
      detail: "Captura cubetas y descarte NTC 1240, o registra entrega de alimento en bultos de 40 kg para descuento automático de bodega.",
    },
    {
      num: "Paso 3",
      title: "Reportar bajas y sanidad",
      detail: "Anota cualquier mortalidad (y pasa a compostaje AGROSAVIA) o aplicación sanitaria indicando días de retiro.",
    },
    {
      num: "Paso 4",
      title: "Cierre diario y Utilidad Neta",
      detail: "Al final de la tarde sincroniza si volvió la señal, verifica alertas de costo y ejecuta el Cierre Diario.",
    },
  ]);

  doc.drawSectionTitle("2. Semáforo de Tiempo de Retiro Farmacológico (Hoy)");
  if (data.activeWithdrawals.length === 0) {
    doc.drawAlertBox(
      "SEMÁFORO VERDE · Sin retiros farmacológicos activos hoy",
      ["Ningún galpón ni lote presenta restricción sanitaria activa de medicamento. Venta de huevo y carne habilitada."],
      "ok",
    );
  } else {
    const shown = data.activeWithdrawals.slice(0, 4).map((w) => {
      const target = w.batchCode || w.locationName || w.species || "Todo el predio";
      return `* BLOQUEADO hasta ${w.withdrawalUntilDate}: ${w.product || w.type} (${target})`;
    });
    if (data.activeWithdrawals.length > 4) {
      shown.push(`* ... y ${data.activeWithdrawals.length - 4} bloqueo(s) adicional(es) activos en sistema.`);
    }
    doc.drawAlertBox(
      `SEMÁFORO ROJO · ${data.activeWithdrawals.length} lote(s)/lugar(es) en retiro activo`,
      shown,
      "danger",
    );
  }

  doc.drawSectionTitle("3. Tabla Oficial NTC 1240 (Clasificación de Huevo) y Trazabilidad PEPS");
  doc.drawTable(
    ["Calibre NTC 1240", "Peso por unidad", "Criterio comercial", "Rotación PEPS / Conservación"],
    [
      ...NTC1240_GRADES.map((g) => [
        g.code,
        g.rangeHint,
        g.code === "AA" || g.code === "AAA" || g.code === "Jumbo" ? "Mesa / Tienda / Mayorista" : "Pastelería / Consumo / Detal",
        "Lote H-YYYYMMDD · T° 10-15 °C · HR 75-85%",
      ]),
      ["Descarte", "Roto / Sucio grave", "No apto venta mesa directa", "Separar en el mismo turno del galpón"],
    ],
    [1.1, 1.1, 2.0, 2.5],
    7.6,
  );

  return doc.buildBuffer();
}

export function buildCompostingPoePdf(data: CompostingPoePdfData): Buffer {
  const doc = new PdfDocumentBuilder(
    "Ficha de Compostaje AGROSAVIA y POE Bioseguridad",
    `Res. ICA 30292/2017 y 8452/2025 · ${data.farmName} (${data.municipality})`,
    `Corte: ${data.generatedAt}`,
    data.generatedAt,
  );

  doc.drawSectionTitle("1. Fórmulas Trapezoidales AGROSAVIA (Compostaje de Mortalidad)");
  doc.drawTable(
    ["Fórmula", "Proporción en peso", "Armado por capas en cajón", "Parámetros meta (8 semanas)"],
    [
      [
        "3:1:1",
        "3 Gallinaza : 1 Mortalidad : 1 Carbono seco",
        "Base viruta 25 cm -> capa mortalidad sin tocar bordes -> gallinaza húmeda -> sello carbono",
        "T° termófila 55-65 °C · Humedad 50-60%",
      ],
      [
        "7:2:2",
        "7 Gallinaza : 2 Mortalidad : 2 Carbono seco",
        "Cama aves/conejos alternada con mortalidad y cascarilla de arroz o aserrín seco",
        "Volteo semanal o al caer T° < 48 °C · Cosecha día 56",
      ],
    ],
    [0.8, 1.7, 2.3, 1.9],
    7.6,
  );

  doc.drawSectionTitle("2. Estado Actual de Pilas de Compostaje en el Predio");
  doc.drawTable(
    ["Código", "Pila / Lugar", "Fórmula", "T° C", "HR %", "Volteos", "Próx. volteo / Cosecha", "Estado"],
    data.piles.map((p) => [
      p.code,
      p.locationName ? `${p.name} (${p.locationName})` : p.name,
      p.formulaRatio,
      p.currentTempC ?? "-",
      p.moisturePct ?? "-",
      String(p.turnCount),
      `${p.nextTurnDueDate || "-"} / ${p.expectedHarvestDate || "-"}`,
      p.status.toUpperCase(),
    ]),
    [0.8, 1.8, 0.7, 0.55, 0.55, 0.6, 1.4, 0.85],
    7.4,
  );

  doc.drawSectionTitle("3. POE Vacío Sanitario y Protocolo de Desinfección");
  doc.drawAlertBox(
    `Regla Obligatoria: Vacío Sanitario Mínimo de ${data.sanitaryEmptyDaysRequired} Días por Galpón`,
    [
      "1. Retirar aves/mamíferos y gallinaza/cama hacia zona de compostaje (Zona Sucia).",
      "2. Limpieza en seco total -> lavado a presión con detergente agrícola -> enjuague y secado.",
      "3. Desinfección alternada (amonio cuaternario / glutaraldehído / cal en pisos y paredes).",
      `4. Respetar descanso sanitario completo de ${data.sanitaryEmptyDaysRequired} días antes de alojar nuevo lote.`,
      `5. Ingreso de visitantes/vehículos solo por pediluvio y rodaluvio en Zona Limpia. Registros bioseguridad últimos 30 días: ${data.recentBiosecurityCount30d}.`,
    ],
    "ok",
  );

  return doc.buildBuffer();
}

export function buildWeek4HandoverActPdf(data: Week4HandoverActPdfData): Buffer {
  const doc = new PdfDocumentBuilder(
    'Acta de Entrega "Llave en Mano" (Semana 4)',
    `Cierre Auditado, Roles y Punto de Equilibrio · ${data.farmName}`,
    `Corte: ${data.generatedAt}`,
    data.generatedAt,
  );

  doc.drawKeyValueGrid(
    [
      { label: "Predio / Municipio", value: `${data.farmName} · ${data.municipality}` },
      { label: "Altitud / Escala", value: `${data.altitudeMeters || "-"} msnm · Escala ${data.scale}` },
      { label: "Plan Activo / Período", value: `${data.planCode} (${data.periodFrom} a ${data.periodTo})` },
    ],
    3,
  );

  doc.drawSectionTitle("1. Cumplimiento del Cronograma Ruta 2 (Semanas 1 a 4)");
  const statusLabel = (s: WeekStatusItem["status"]) =>
    s === "completado" ? "COMPLETADO" : s === "en_progreso" ? "EN PROGRESO" : "PENDIENTE";
  doc.drawTable(
    ["Etapa", "Hito de implementación", "Estado", "Evidencia verificada en base de datos"],
    data.roadmap.map((w) => [`Semana ${w.week}`, w.title, statusLabel(w.status), w.evidence]),
    [0.85, 2.2, 1.05, 2.7],
    7.8,
  );

  doc.drawSectionTitle("2. Equipo Operativo y Matriz de Roles Activos (RBAC)");
  doc.drawTable(
    ["Integrante", "Usuario", "Rol", "Permisos habilitados"],
    data.team.map((m) => [m.name, `@${m.username}`, m.roleLabel, m.keyPermissions]),
    [1.6, 1.1, 1.1, 2.9],
    7.6,
  );

  doc.drawSectionTitle("3. Censo Vivo por Especie y Último Cierre Diario Auditado");
  doc.drawTable(
    ["Especie", "Cantidad viva hoy"],
    [
      ...data.census.map((c) => [c.label, String(c.count)]),
      ["TOTAL ANIMALES ACTIVOS", String(data.totalLiveAnimals)],
    ],
    [3.5, 1.5],
    8,
  );

  if (data.lastClosure) {
    doc.drawAlertBox(
      `Último Cierre Diario Auditado: ${data.lastClosure.closureDate} (${data.lastClosure.status.toUpperCase()})`,
      [
        `Cerrado por: ${data.lastClosure.closedByName || "Usuario sistema"} | Huevos del día: ${data.lastClosure.eggsCollected} | Bajas: ${data.lastClosure.mortalityCount}`,
        `Ingresos del día: ${formatCop(data.lastClosure.dayIncome)} | Egresos del día: ${formatCop(data.lastClosure.dayExpense)}`,
      ],
      data.lastClosure.status === "cerrado" ? "ok" : "warn",
    );
  } else {
    doc.drawAlertBox(
      "Marcha Blanca Pendiente: Sin Cierre Diario Auditado Registrado",
      ["Ejecuta el primer Cierre Diario en Operaciones para dejar trazabilidad auditada de fin de jornada."],
      "warn",
    );
  }

  doc.drawSectionTitle("4. Punto de Equilibrio Unitario y Rentabilidad Real (Anti-Subsidio Cruzado)");
  doc.drawKeyValueGrid(
    [
      { label: "Ingresos directos período", value: formatCop(data.unitEconomics.directRevenue) },
      { label: "Costos totales (dir + prorr.)", value: formatCop(data.unitEconomics.totalCost) },
      { label: "Utilidad neta operativa", value: formatCop(data.unitEconomics.netProfit) },
    ],
    3,
  );

  doc.drawTable(
    ["Unidad productiva", "Costo real unitario", "Equivalencia comercial", "Precio venta prom.", "Estado"],
    [
      [
        "Huevo (postura)",
        formatCop(data.unitEconomics.realCostPerEgg),
        `Cubeta x30: ${formatCop(data.unitEconomics.realCostPerTray30)}`,
        data.unitEconomics.avgSalePricePerEgg > 0 ? formatCop(data.unitEconomics.avgSalePricePerEgg) : "Sin ventas",
        data.unitEconomics.eggBreakevenAlert ? "ALERTA BAJO COSTO" : "OK",
      ],
      [
        "Carne (kg en pie / canal)",
        `Pie: ${formatCop(data.unitEconomics.realCostPerLiveKg)}`,
        `Canal: ${formatCop(data.unitEconomics.realCostPerCarcassKg)}`,
        data.unitEconomics.avgMeatSalePricePerKg > 0 ? formatCop(data.unitEconomics.avgMeatSalePricePerKg) : "Sin ventas",
        data.unitEconomics.meatBreakevenAlert ? "ALERTA BAJO COSTO" : "OK",
      ],
    ],
    [1.4, 1.3, 1.6, 1.3, 1.2],
    7.8,
  );

  doc.drawSectionTitle("5. Constancia de Entrega y Recepción a Satisfacción");
  doc.drawParagraph(
    "Con la firma de esta acta se certifica la parametrización operativa del predio, las placas QR plastificadas en galpón, la matriz de roles de usuario y la capacitación en el flujo diario menor a 2 minutos.",
    8.2,
  );
  doc.drawSignatureRow([
    "Propietario",
    "Gerente de Granja",
    "Veterinario / Zootecnista",
    "Implementador Iwagé",
  ]);

  return doc.buildBuffer();
}

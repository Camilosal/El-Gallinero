import { describe, expect, it } from "vitest";
import {
  BITACORA_ARTICLES,
  getRelatedBitacoraArticles,
} from "@/lib/bitacora-content";
import { guides } from "@/lib/guide-data";
import { NORMATIVE_CATALOG } from "@/lib/normative-catalog";

describe("EVD-01 y GEO-01 — Evidencia trazable y grafo temático en Bitácora", () => {
  const normIds = new Set(NORMATIVE_CATALOG.map((item) => item.id));
  const guideSlugs = new Set(guides.map((g) => g.slug));
  const articleSlugs = new Set(BITACORA_ARTICLES.map((a) => a.slug));

  it("todos los artículos declaran metadatos completos de procedencia, método, revisión y alcance", () => {
    for (const article of BITACORA_ARTICLES) {
      const ev = article.realFarmData;
      expect(["observacion_piloto", "ejemplo_metodologico", "referencia_normativa"]).toContain(
        ev.kind,
      );
      expect(ev.observationPeriod.trim().length).toBeGreaterThan(5);
      expect(ev.contextAndSample.trim().length).toBeGreaterThan(10);
      expect(ev.unitAndMethod.trim().length).toBeGreaterThan(10);
      expect(ev.sourceRef.trim().length).toBeGreaterThan(5);
      expect(ev.reviewedBy.trim().length).toBeGreaterThan(3);
      expect(ev.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.reviewedAt).toBe(ev.reviewedAt);
      expect(ev.reviewedAt >= article.publishedAt).toBe(true);
      expect(ev.limitations.trim().length).toBeGreaterThan(10);
    }
  });

  it("la taxonomía, guías relacionadas y normas referenciadas resuelven 100% en el catálogo", () => {
    for (const article of BITACORA_ARTICLES) {
      expect(article.topics.length).toBeGreaterThanOrEqual(2);
      expect(article.species.length).toBeGreaterThanOrEqual(1);
      expect(guideSlugs.has(article.relatedGuideSlug)).toBe(true);
      expect(article.relatedNormIds.length).toBeGreaterThanOrEqual(1);
      for (const normId of article.relatedNormIds) {
        expect(normIds.has(normId)).toBe(true);
      }
      for (const relSlug of article.relatedSlugs) {
        expect(relSlug).not.toBe(article.slug);
        expect(articleSlugs.has(relSlug)).toBe(true);
      }
    }
  });

  it("getRelatedBitacoraArticles ordena por afinidad temática y nunca devuelve el mismo artículo", () => {
    for (const article of BITACORA_ARTICLES) {
      const related = getRelatedBitacoraArticles(article, 3);
      expect(related.length).toBe(3);
      expect(related.map((r) => r.slug)).not.toContain(article.slug);
    }

    const compostaje = BITACORA_ARTICLES.find((a) => a.slug === "compostaje-de-gallinaza")!;
    const compostajeRelated = getRelatedBitacoraArticles(compostaje, 3);
    expect(compostajeRelated[0].slug).toBe("tiempos-de-retiro-medicamentos-veterinarios");
  });
});

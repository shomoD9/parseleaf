/**
 * This file holds the small cross-cutting utilities that keep the rest of the
 * pipeline honest about paths, text normalization, and naming. It exists as a
 * separate module because EPUB conversion is full of repetitive low-level moves:
 * resolving archive-relative links, splitting href fragments, and generating safe
 * output names. The parser, section builder, markdown layer, and output writer all
 * depend on these helpers, so this file effectively acts as the glue vocabulary for
 * the rest of the codebase.
 */

import path from "node:path";

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  // EPUB XML structures often collapse single items into scalars, so we normalize
  // everything to arrays before the rest of the code starts reasoning about order.
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function dirnamePosix(filePath: string): string {
  const directory = path.posix.dirname(filePath);
  return directory === "." ? "" : directory;
}

export function splitHref(href: string): { path: string; anchor: string | null } {
  const hashIndex = href.indexOf("#");

  if (hashIndex === -1) {
    return { path: href, anchor: null };
  }

  return {
    path: href.slice(0, hashIndex),
    anchor: href.slice(hashIndex + 1) || null
  };
}

export function resolveArchivePath(basePath: string, href: string): string {
  const target = splitHref(href).path;
  const baseDirectory = dirnamePosix(basePath);

  // We keep everything in POSIX form because EPUB archive paths always use `/`,
  // even when the tool is running on a different host operating system.
  return path.posix.normalize(path.posix.join(baseDirectory, target));
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/_/g, " ");

  const collapsed = normalized
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return collapsed || "section";
}

export function createOrderPrefix(order: number, total: number): string {
  const width = Math.max(2, String(total).length);
  return String(order).padStart(width, "0");
}

export function isExternalHref(href: string): boolean {
  return /^(?:[a-z]+:)?\/\//i.test(href) || href.startsWith("mailto:");
}

export function sanitizePathSegment(segment: string): string {
  const extension = path.posix.extname(segment).toLowerCase();
  const stem = extension ? segment.slice(0, -extension.length) : segment;
  const safeStem = slugify(stem);
  return `${safeStem}${extension}`;
}

export function toOutputAssetPath(archivePath: string): string {
  const parts = archivePath.split("/").filter(Boolean).map(sanitizePathSegment);
  return path.posix.join("assets", ...parts);
}

export function pickFirstText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = collapseWhitespace(value);
    return text || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = pickFirstText(item);
      if (text) {
        return text;
      }
    }

    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    // XML parsers often store textual content under `#text` or `text`, so we
    // check those explicit slots before falling back to the rest of the object.
    const directText = pickFirstText(record["#text"] ?? record.text);
    if (directText) {
      return directText;
    }

    for (const nested of Object.values(record)) {
      const text = pickFirstText(nested);
      if (text) {
        return text;
      }
    }
  }

  return null;
}

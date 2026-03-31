/**
 * This file tests the small utility helpers that the rest of the pipeline leans
 * on. It exists separately because naming, href splitting, and archive-relative
 * path resolution are foundational behaviors; if they drift, the parser and the
 * output writer both become quietly wrong. It talks directly to `src/utils.ts`.
 */

import { describe, expect, it } from "vitest";

import {
  resolveArchivePath,
  slugify,
  splitHref,
  toOutputAssetPath
} from "../src/utils.js";

describe("slugify", () => {
  it("turns titles into stable lowercase file slugs", () => {
    expect(slugify("Chapter 1: Rivers & Memory")).toBe("chapter-1-rivers-memory");
  });
});

describe("splitHref", () => {
  it("separates the document path from the fragment", () => {
    expect(splitHref("chapter-1.xhtml#note-1")).toEqual({
      path: "chapter-1.xhtml",
      anchor: "note-1"
    });
  });
});

describe("resolveArchivePath", () => {
  it("resolves links relative to the current document", () => {
    expect(resolveArchivePath("OEBPS/nav.xhtml", "images/figure.svg")).toBe(
      "OEBPS/images/figure.svg"
    );
  });
});

describe("toOutputAssetPath", () => {
  it("rewrites asset archive paths into safe output paths", () => {
    expect(toOutputAssetPath("OEBPS/images/Figure 1.SVG")).toBe(
      "assets/oebps/images/figure-1.svg"
    );
  });
});

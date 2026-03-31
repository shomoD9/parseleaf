/**
 * This file tests section-boundary inference directly. It exists separately so we
 * can verify the semantic splitting logic without having to inspect the final file
 * writer every time. It talks to the real EPUB parser, the sectioning module, and
 * the fixture-builder helper that turns readable source trees into EPUB archives.
 */

import { describe, expect, it } from "vitest";

import { parseEpub } from "../src/parse-epub.js";
import { buildSections, classifySectionType } from "../src/sectioning.js";
import { buildFixtureEpub, cleanupTempPath } from "./helpers.js";

describe("buildSections", () => {
  it("merges a multi-file chapter into one semantic section", async () => {
    const epubPath = await buildFixtureEpub("epub3");

    try {
      const parsed = await parseEpub(epubPath);
      const sections = buildSections(parsed);
      const chapter = sections.find((section) => section.title === "Chapter 1 The River");

      expect(sections.map((section) => section.title)).toEqual([
        "Contents",
        "Preface",
        "Chapter 1 The River",
        "Appendix A"
      ]);
      expect(chapter?.sourceArchivePaths).toEqual([
        "OEBPS/chapter-1a.xhtml",
        "OEBPS/chapter-1b.xhtml"
      ]);
    } finally {
      await cleanupTempPath(epubPath);
    }
  });
});

describe("classifySectionType", () => {
  it("recognizes common semantic labels", () => {
    expect(classifySectionType("Preface", ["preface"], "preface.xhtml")).toBe("preface");
    expect(classifySectionType("Appendix A", [], "appendix.xhtml")).toBe("appendix");
  });
});

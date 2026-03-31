/**
 * This file exercises the full conversion pipeline from fixture EPUB to generated
 * markdown directory. It exists separately because integration behavior is where
 * the tool's real promise lives: chapter grouping, manifest writing, asset copying,
 * and internal-link rewriting all have to cohere at once. It talks to the helper
 * that builds fixture EPUBs, then inspects the files written by the main converter.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { cleanupTempPath, convertFixture } from "./helpers.js";

describe("convertEpub", () => {
  it("converts an EPUB 3 book into semantic markdown sections", async () => {
    const run = await convertFixture("epub3");

    try {
      const manifest = JSON.parse(await readFile(run.manifestPath, "utf8")) as {
        sections: Array<{ file: string; title: string; sectionType: string }>;
        assets: Array<{ outputPath: string }>;
      };
      const chapterMarkdown = await readFile(
        path.join(run.outputDirectory, "03-chapter-1-the-river.md"),
        "utf8"
      );
      const appendixMarkdown = await readFile(
        path.join(run.outputDirectory, "04-appendix-a.md"),
        "utf8"
      );

      expect(
        manifest.sections.map((section) => ({
          file: section.file,
          title: section.title,
          sectionType: section.sectionType
        }))
      ).toEqual([
        {
          file: "01-contents.md",
          title: "Contents",
          sectionType: "toc"
        },
        {
          file: "02-preface.md",
          title: "Preface",
          sectionType: "preface"
        },
        {
          file: "03-chapter-1-the-river.md",
          title: "Chapter 1 The River",
          sectionType: "chapter"
        },
        {
          file: "04-appendix-a.md",
          title: "Appendix A",
          sectionType: "appendix"
        }
      ]);

      expect(
        manifest.assets.map((asset) => ({
          outputPath: asset.outputPath
        }))
      ).toEqual([
        {
          outputPath: "assets/oebps/images/diagram.svg"
        }
      ]);

      expect(chapterMarkdown).toContain("![River diagram](assets/oebps/images/diagram.svg)");
      expect(chapterMarkdown).toContain("[1](#note-1)");
      expect(chapterMarkdown).toContain("<a id=\"note-1\"></a>");
      expect(chapterMarkdown).toContain("This note survives the merge.");

      expect(appendixMarkdown).toContain("| Term | Meaning |");
      expect(appendixMarkdown).toContain("| Spine | Reading order |");
    } finally {
      await cleanupTempPath(path.dirname(run.epubPath));
      await cleanupTempPath(run.outputDirectory);
    }
  });

  it("uses NCX navigation when an EPUB 2 book has no nav document", async () => {
    const run = await convertFixture("epub2");

    try {
      const manifest = JSON.parse(await readFile(run.manifestPath, "utf8")) as {
        sections: Array<{ title: string; sectionType: string }>;
      };

      expect(
        manifest.sections.map((section) => ({
          title: section.title,
          sectionType: section.sectionType
        }))
      ).toEqual([
        { title: "Introduction", sectionType: "introduction" },
        { title: "Chapter One", sectionType: "chapter" },
        { title: "Notes", sectionType: "notes" }
      ]);
    } finally {
      await cleanupTempPath(path.dirname(run.epubPath));
      await cleanupTempPath(run.outputDirectory);
    }
  });

  it("falls back to one section per meaningful spine document when navigation is missing", async () => {
    const run = await convertFixture("degraded");

    try {
      const manifest = JSON.parse(await readFile(run.manifestPath, "utf8")) as {
        sections: Array<{ title: string; file: string }>;
      };

      expect(
        manifest.sections.map((section) => ({
          title: section.title,
          file: section.file
        }))
      ).toEqual([
        { title: "Opening Argument", file: "01-opening-argument.md" },
        { title: "Second Movement", file: "02-second-movement.md" }
      ]);
    } finally {
      await cleanupTempPath(path.dirname(run.epubPath));
      await cleanupTempPath(run.outputDirectory);
    }
  });
});

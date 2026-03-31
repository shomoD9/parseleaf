/**
 * This file handles the final act of the system: writing markdown files, copying
 * extracted assets, and serializing the conversion manifest to disk. It exists as
 * its own module because output concerns should stay downstream from parsing and
 * markdown generation. It talks to the parsed archive so it can fetch asset bytes,
 * to `markdown.ts` so it can render section content, and to the filesystem so the
 * rest of the application can end with a concrete directory structure on disk.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { stringify as stringifyYaml } from "yaml";

import { convertSectionToMarkdown } from "./markdown.js";
import type { ConvertedSection, OutputManifest, ParsedEpub, SectionPlan } from "./types.js";
import { createOrderPrefix, slugify } from "./utils.js";

export async function writeOutput(
  parsed: ParsedEpub,
  sections: SectionPlan[],
  outputDirectory: string
): Promise<{ outputDirectory: string; manifest: OutputManifest }> {
  await mkdir(outputDirectory, { recursive: true });

  const fileNames = assignFileNames(sections);
  const sectionFileByTarget = buildTargetMap(sections, fileNames);
  const convertedSections = sections.map((section, index) => {
    const fileName = fileNames[index];
    if (!fileName) {
      throw new Error(`No output file name was generated for section "${section.title}".`);
    }

    return convertSectionToMarkdown(parsed, section, fileName, sectionFileByTarget);
  });

  const assetsBySourcePath = new Map<string, ConvertedSection["assets"][number]>();

  for (const section of convertedSections) {
    const frontmatter = stringifyYaml({
      book_title: parsed.metadata.title,
      book_author: parsed.metadata.author,
      section_type: section.sectionType,
      section_title: section.title,
      order: section.order,
      source_hrefs: section.sourceHrefs,
      source_anchor: section.sourceAnchor,
      nav_label: section.navLabel
    }).trimEnd();

    const fileContent = `---\n${frontmatter}\n---\n\n${section.markdown}\n`;
    await writeFile(path.join(outputDirectory, section.fileName), fileContent, "utf8");

    // Assets are collected during markdown conversion so we only copy the files
    // that the generated markdown actually ended up referencing.
    for (const asset of section.assets) {
      assetsBySourcePath.set(asset.sourcePath, asset);
    }
  }

  for (const asset of assetsBySourcePath.values()) {
    const zipEntry = parsed.zip.file(asset.sourcePath);
    if (!zipEntry) {
      continue;
    }

    const outputPath = path.join(outputDirectory, asset.outputPath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    const contents = await zipEntry.async("nodebuffer");
    await writeFile(outputPath, contents);
  }

  const manifest: OutputManifest = {
    book: {
      title: parsed.metadata.title,
      author: parsed.metadata.author,
      language: parsed.metadata.language,
      slug: slugify(parsed.metadata.title),
      inputFile: parsed.inputName
    },
    generatedAt: new Date().toISOString(),
    sections: convertedSections.map((section) => ({
      order: section.order,
      file: section.fileName,
      title: section.title,
      navLabel: section.navLabel,
      sectionType: section.sectionType,
      sourceAnchor: section.sourceAnchor,
      sourceHrefs: section.sourceHrefs,
      sourceArchivePaths: section.sourceArchivePaths,
      assets: section.assets
    })),
    assets: [...assetsBySourcePath.values()]
  };

  await writeFile(
    path.join(outputDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  return {
    outputDirectory,
    manifest
  };
}

function assignFileNames(sections: SectionPlan[]): string[] {
  const total = sections.length;
  const seen = new Map<string, number>();

  return sections.map((section) => {
    const prefix = createOrderPrefix(section.order, total);
    const baseSlug = slugify(section.title);
    const count = seen.get(baseSlug) ?? 0;
    seen.set(baseSlug, count + 1);

    const uniqueSlug = count ? `${baseSlug}-${count + 1}` : baseSlug;
    return `${prefix}-${uniqueSlug}.md`;
  });
}

function buildTargetMap(sections: SectionPlan[], fileNames: string[]): Map<string, string> {
  const targets = new Map<string, string>();

  sections.forEach((section, index) => {
    const fileName = fileNames[index];
    if (!fileName) {
      throw new Error(`No output file name was generated for section "${section.title}".`);
    }

    section.parts.forEach((part) => {
      targets.set(part.archivePath, fileName);

      // Exact fragment starts get their own mapping so links aimed at a known
      // section boundary land in the right output file even if multiple sections
      // originated from the same source XHTML document.
      if (part.startAnchor) {
        targets.set(`${part.archivePath}#${part.startAnchor}`, fileName);
      }
    });
  });

  return targets;
}

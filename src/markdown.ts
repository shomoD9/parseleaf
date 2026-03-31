/**
 * This file is responsible for turning section HTML fragments into final markdown.
 * It exists separately because HTML cleanup, internal-link rewriting, anchor
 * preservation, asset extraction, and markdown rendering are a different kind of
 * work from EPUB parsing or semantic section inference. It talks to the section
 * plans produced by `sectioning.ts`, the archive metadata from `types.ts`, and the
 * shared helpers in `utils.ts`, and it returns markdown plus the asset inventory
 * each section ended up depending on.
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";

import type { AssetRecord, ConvertedSection, ParsedEpub, SectionPlan } from "./types.js";
import {
  collapseWhitespace,
  isExternalHref,
  resolveArchivePath,
  splitHref,
  toOutputAssetPath
} from "./utils.js";

interface MarkdownContext {
  currentFileName: string;
  sectionFileByTarget: Map<string, string>;
  parsed: ParsedEpub;
}

export function convertSectionToMarkdown(
  parsed: ParsedEpub,
  section: SectionPlan,
  fileName: string,
  sectionFileByTarget: Map<string, string>
): ConvertedSection {
  const assets = new Map<string, AssetRecord>();
  const turndown = createTurndownService();
  const htmlParts = section.parts.map((part) =>
    rewritePartHtml(
      part.html,
      part.archivePath,
      {
        currentFileName: fileName,
        sectionFileByTarget,
        parsed
      },
      assets
    )
  );

  const rawMarkdown = turndown.turndown(htmlParts.join("\n\n"));
  const markdown = normalizeMarkdown(rawMarkdown);

  return {
    order: section.order,
    fileName,
    title: section.title,
    navLabel: section.navLabel,
    sectionType: section.sectionType,
    markdown,
    sourceAnchor: section.sourceAnchor,
    sourceHrefs: section.sourceHrefs,
    sourceArchivePaths: section.sourceArchivePaths,
    assets: [...assets.values()]
  };
}

function rewritePartHtml(
  html: string,
  baseArchivePath: string,
  context: MarkdownContext,
  assets: Map<string, AssetRecord>
): string {
  const $ = cheerio.load(`<div data-section-root="true">${html}</div>`, {
    xmlMode: false
  });
  const root = $("div[data-section-root='true']").first();

  root.find("script, style, link[rel='stylesheet']").remove();

  // We preserve ids as raw HTML anchors so markdown links can still target the
  // same internal destinations after the XHTML has been flattened into prose.
  const seenAnchors = new Set<string>();
  root.find("[id], a[name]").each((_, element) => {
    const node = $(element);
    const anchorId = node.attr("id") ?? (node.is("a") ? node.attr("name") : null);

    if (!anchorId || seenAnchors.has(anchorId)) {
      return;
    }

    seenAnchors.add(anchorId);
    node.before(`<a id="${escapeAttribute(anchorId)}"></a>`);
  });

  root.find("a[href]").each((_, element) => {
    const node = $(element);
    const href = node.attr("href");

    if (!href || isExternalHref(href)) {
      return;
    }

    const rewrittenHref = rewriteHref(href, baseArchivePath, context, assets);
    if (rewrittenHref) {
      node.attr("href", rewrittenHref);
    }
  });

  root.find("img[src]").each((_, element) => {
    const node = $(element);
    const src = node.attr("src");

    if (!src || isExternalHref(src)) {
      return;
    }

    const rewrittenSrc = rewriteAssetReference(src, baseArchivePath, context.parsed, assets);
    if (rewrittenSrc) {
      node.attr("src", rewrittenSrc);
    }
  });

  return root.html() ?? "";
}

function rewriteHref(
  href: string,
  baseArchivePath: string,
  context: MarkdownContext,
  assets: Map<string, AssetRecord>
): string | null {
  const { path, anchor } = splitHref(href);
  const targetArchivePath = path ? resolveArchivePath(baseArchivePath, href) : baseArchivePath;
  const exactTargetKey = anchor ? `${targetArchivePath}#${anchor}` : targetArchivePath;
  const sectionFile =
    context.sectionFileByTarget.get(exactTargetKey) ??
    context.sectionFileByTarget.get(targetArchivePath);

  if (sectionFile) {
    if (sectionFile === context.currentFileName) {
      return anchor ? `#${anchor}` : "#";
    }

    return anchor ? `${sectionFile}#${anchor}` : sectionFile;
  }

  return rewriteAssetReference(href, baseArchivePath, context.parsed, assets);
}

function rewriteAssetReference(
  href: string,
  baseArchivePath: string,
  parsed: ParsedEpub,
  assets: Map<string, AssetRecord>
): string | null {
  const { anchor } = splitHref(href);
  const targetArchivePath = resolveArchivePath(baseArchivePath, href);
  const manifestItem = parsed.manifestByPath.get(targetArchivePath);

  if (!manifestItem) {
    return null;
  }

  if (/xhtml|html/.test(manifestItem.mediaType)) {
    return null;
  }

  const outputPath = toOutputAssetPath(targetArchivePath);
  assets.set(targetArchivePath, {
    sourcePath: targetArchivePath,
    outputPath,
    mediaType: manifestItem.mediaType
  });

  return anchor ? `${outputPath}#${anchor}` : outputPath;
}

function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced"
  });

  turndown.addRule("preserve-id-anchors", {
    filter: (node) =>
      node.nodeName === "A" &&
      Boolean((node as Element).getAttribute("id")) &&
      !(node as Element).getAttribute("href") &&
      !(node as Element).textContent?.trim(),
    replacement: (_content, node) => `<a id="${(node as Element).getAttribute("id")}"></a>`
  });

  turndown.addRule("drop-root-wrapper", {
    filter: (node) =>
      node.nodeName === "DIV" && Boolean((node as Element).getAttribute("data-section-root")),
    replacement: (content) => content
  });

  turndown.addRule("tables", {
    filter: (node) => node.nodeName === "TABLE",
    replacement: (_content, node) => convertTable(node as Element)
  });

  return turndown;
}

function convertTable(node: Element): string {
  const $ = cheerio.load(node.outerHTML, { xmlMode: false });
  const rows = $("tr")
    .toArray()
    .map((row) =>
      $(row)
        .children("th, td")
        .toArray()
        .map((cell) => collapseWhitespace($(cell).text()).replace(/\|/g, "\\|"))
    )
    .filter((row) => row.length);

  if (!rows.length) {
    return "\n\n";
  }

  const header = rows[0];
  if (!header) {
    return "\n\n";
  }
  const body = rows.slice(1);
  const separator = header.map(() => "---");
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...body.map((row) => {
      const padded = [...row];
      while (padded.length < header.length) {
        padded.push("");
      }
      return `| ${padded.join(" | ")} |`;
    })
  ];

  return `\n\n${lines.join("\n")}\n\n`;
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, "&quot;");
}

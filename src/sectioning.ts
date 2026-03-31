/**
 * This file turns parsed EPUB metadata into the semantic section plan that drives
 * the output files. It exists separately because "what is in the book" and "how we
 * want to split the book" are related but different questions. The parser gives us
 * the raw publication structure, while this module interprets that structure into
 * chapters, prefaces, contents pages, appendices, and fallback sections. It talks
 * to the parsed EPUB model coming from `parse-epub.ts` and returns section plans
 * that the markdown and output layers can render.
 */

import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";

import type {
  NavItem,
  ParsedEpub,
  SectionPart,
  SectionPlan,
  SectionType,
  SemanticReference,
  SpineDocument
} from "./types.js";
import { collapseWhitespace, slugify } from "./utils.js";

interface DocumentBlock {
  html: string;
  anchorIds: Set<string>;
}

interface DocumentOutline {
  document: SpineDocument;
  index: number;
  title: string | null;
  blocks: DocumentBlock[];
  meaningful: boolean;
}

interface Boundary {
  navItem: NavItem;
  docIndex: number;
}

const WRAPPER_TAGS = new Set(["div", "section", "article", "main"]);

export function buildSections(parsed: ParsedEpub): SectionPlan[] {
  const outlines = parsed.spineDocuments.map((document, index) => buildDocumentOutline(document, index));
  const explicitPaths = new Set<string>();

  // These explicit references are the paths we should treat as intentional parts
  // of the book even if the raw document itself looks sparse or ornamental.
  for (const reference of [...parsed.navItems, ...parsed.landmarks, ...parsed.guideReferences]) {
    if (reference.archivePath) {
      explicitPaths.add(reference.archivePath);
    }
  }

  const boundaries = buildBoundaries(parsed.navItems, outlines);

  if (!boundaries.length) {
    return buildFallbackSections(parsed, outlines, explicitPaths);
  }

  const sections: SectionPlan[] = [];

  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index];
    if (!boundary) {
      continue;
    }

    const nextBoundary = boundaries[index + 1] ?? null;
    const section = buildSectionFromBoundary(
      boundary,
      nextBoundary,
      outlines,
      parsed.landmarks,
      parsed.guideReferences,
      explicitPaths
    );

    if (section) {
      sections.push({
        ...section,
        order: sections.length + 1
      });
    }
  }

  return sections.length ? sections : buildFallbackSections(parsed, outlines, explicitPaths);
}

export function classifySectionType(
  label: string,
  semanticTypes: string[],
  href: string
): SectionType {
  const haystack = `${label} ${semanticTypes.join(" ")} ${href}`.toLowerCase();

  // We prefer explicit EPUB semantics when they exist, but we still backstop them
  // with text heuristics because many real books are only partially well-formed.
  if (/(^|\s)(toc|tableofcontents|table-of-contents|contents)(\s|$)/.test(haystack) || /\bcontents\b/.test(haystack)) {
    return "toc";
  }

  if (/\bpreface\b/.test(haystack)) {
    return "preface";
  }

  if (/\bforeword\b/.test(haystack)) {
    return "foreword";
  }

  if (/\bintroduction\b/.test(haystack)) {
    return "introduction";
  }

  if (/\bappendix\b/.test(haystack)) {
    return "appendix";
  }

  if (/\b(notes|endnotes)\b/.test(haystack)) {
    return "notes";
  }

  if (/\b(bibliography|references|works-cited)\b/.test(haystack)) {
    return "bibliography";
  }

  if (/\bindex\b/.test(haystack)) {
    return "index";
  }

  if (/\b(acknowledg?ments|acknowledgements)\b/.test(haystack)) {
    return "acknowledgments";
  }

  if (/\b(title-page|titlepage)\b/.test(haystack)) {
    return "title-page";
  }

  if (/\bcover\b/.test(haystack)) {
    return "cover";
  }

  if (/\b(chapter|part)\b/.test(haystack)) {
    return "chapter";
  }

  return "chapter";
}

function buildBoundaries(navItems: NavItem[], outlines: DocumentOutline[]): Boundary[] {
  const docIndexByPath = new Map(outlines.map((outline) => [outline.document.archivePath, outline.index]));
  const seen = new Set<string>();

  return navItems
    .map((navItem) => {
      if (!navItem.archivePath) {
        return null;
      }

      const docIndex = docIndexByPath.get(navItem.archivePath);
      if (docIndex === undefined) {
        return null;
      }

      const dedupeKey = `${navItem.archivePath}#${navItem.anchor ?? ""}`;
      if (seen.has(dedupeKey)) {
        return null;
      }

      seen.add(dedupeKey);
      return { navItem, docIndex } satisfies Boundary;
    })
    .filter((boundary): boundary is Boundary => boundary !== null);
}

function buildFallbackSections(
  parsed: ParsedEpub,
  outlines: DocumentOutline[],
  explicitPaths: Set<string>
): SectionPlan[] {
  const sections: SectionPlan[] = [];

  for (const outline of outlines) {
    if (!outline.meaningful && !explicitPaths.has(outline.document.archivePath)) {
      continue;
    }

    // In fallback mode each meaningful spine document becomes its own section,
    // because the book gave us no reliable semantic landmarks to do better.
    const title = outline.title ?? `Section ${sections.length + 1}`;
    sections.push({
      order: sections.length + 1,
      title,
      navLabel: title,
      sectionType: classifySectionType(title, [], outline.document.href),
      sourceAnchor: null,
      sourceHrefs: [outline.document.href],
      sourceArchivePaths: [outline.document.archivePath],
      parts: [
        {
          archivePath: outline.document.archivePath,
          href: outline.document.href,
          html: outline.blocks.map((block) => block.html).join("\n"),
          startAnchor: null,
          endAnchor: null
        }
      ]
    });
  }

  return sections;
}

function buildSectionFromBoundary(
  boundary: Boundary,
  nextBoundary: Boundary | null,
  outlines: DocumentOutline[],
  landmarks: SemanticReference[],
  guideReferences: SemanticReference[],
  explicitPaths: Set<string>
): Omit<SectionPlan, "order"> | null {
  const parts: SectionPart[] = [];
  const sourceHrefs = new Set<string>();
  const sourceArchivePaths = new Set<string>();
  const lastDocumentIndex =
    nextBoundary === null
      ? outlines.length - 1
      : nextBoundary.docIndex === boundary.docIndex
        ? nextBoundary.docIndex
        : nextBoundary.docIndex - 1;

  for (let docIndex = boundary.docIndex; docIndex <= lastDocumentIndex; docIndex += 1) {
    const outline = outlines[docIndex];
    if (!outline) {
      continue;
    }

    const startAnchor = docIndex === boundary.docIndex ? boundary.navItem.anchor : null;
    const endAnchor = nextBoundary && docIndex === nextBoundary.docIndex ? nextBoundary.navItem.anchor : null;
    const html = sliceOutline(outline, startAnchor, endAnchor);

    if (!html && !explicitPaths.has(outline.document.archivePath)) {
      continue;
    }

    if (!outline.meaningful && !explicitPaths.has(outline.document.archivePath)) {
      continue;
    }

    parts.push({
      archivePath: outline.document.archivePath,
      href: outline.document.href,
      html,
      startAnchor,
      endAnchor
    });
    sourceHrefs.add(outline.document.href);
    sourceArchivePaths.add(outline.document.archivePath);
  }

  if (!parts.length) {
    return null;
  }

  const semanticTypes = collectSemanticTypes(
    boundary.navItem.archivePath,
    boundary.navItem.anchor,
    [...landmarks, ...guideReferences]
  );
  const title =
    boundary.navItem.label ||
    outlines[boundary.docIndex]?.title ||
    `Section ${boundary.navItem.order + 1}`;

  return {
    title,
    navLabel: boundary.navItem.label,
    sectionType: classifySectionType(title, semanticTypes, boundary.navItem.href),
    sourceAnchor: boundary.navItem.anchor,
    sourceHrefs: [...sourceHrefs],
    sourceArchivePaths: [...sourceArchivePaths],
    parts
  };
}

function collectSemanticTypes(
  archivePath: string | null,
  anchor: string | null,
  references: SemanticReference[]
): string[] {
  if (!archivePath) {
    return [];
  }

  return references
    .filter((reference) => {
      if (reference.archivePath !== archivePath) {
        return false;
      }

      // If the semantic reference names a fragment, we only treat it as matching
      // when the boundary points at the same fragment.
      if (reference.anchor && reference.anchor !== anchor) {
        return false;
      }

      return true;
    })
    .map((reference) => reference.type);
}

function buildDocumentOutline(document: SpineDocument, index: number): DocumentOutline {
  const $ = cheerio.load(document.content, { xmlMode: false });
  const contentRoot = findContentRoot($);
  const blocks = collectBlocks($, contentRoot);
  const text = collapseWhitespace(contentRoot.text());
  const title =
    collapseWhitespace(contentRoot.find("h1, h2, h3").first().text()) ||
    collapseWhitespace($("title").first().text()) ||
    null;

  return {
    document,
    index,
    title,
    blocks,
    meaningful: isMeaningfulDocument(text, document.archivePath, blocks.length)
  };
}

function findContentRoot($: CheerioAPI): Cheerio<Element> {
  let current = $("body").first();
  if (!current.length) {
    current = $.root().children().first();
  }

  // Many EPUB files wrap the actual body in one pointless div, so we peel those
  // wrappers back until we hit a level with multiple logical content children.
  while (true) {
    const elementChildren = current
      .children()
      .toArray()
      .filter((node) => node.type === "tag");

    if (elementChildren.length !== 1) {
      return current;
    }

    const onlyChild = elementChildren[0];
    if (!onlyChild || !WRAPPER_TAGS.has(onlyChild.tagName)) {
      return current;
    }

    const child = $(onlyChild);
    const grandChildren = child
      .children()
      .toArray()
      .filter((node) => node.type === "tag");

    if (!grandChildren.length) {
      return current;
    }

    current = child;
  }
}

function collectBlocks(
  $: CheerioAPI,
  contentRoot: Cheerio<Element>
): DocumentBlock[] {
  const nodes = contentRoot.contents().toArray().filter((node) => {
    if (node.type === "text") {
      return collapseWhitespace($(node).text()).length > 0;
    }

    return node.type === "tag";
  });

  if (!nodes.length) {
    return [];
  }

  return nodes.map((node) => ({
    html: $.html(node),
    anchorIds: collectAnchorIds($, node)
  }));
}

function collectAnchorIds($: CheerioAPI, node: AnyNode): Set<string> {
  const ids = new Set<string>();
  const element = $(node);

  const ownId = element.attr("id");
  const ownName = element.is("a") ? element.attr("name") : null;

  if (ownId) {
    ids.add(ownId);
  }

  if (ownName) {
    ids.add(ownName);
  }

  element.find("[id], a[name]").each((_, nested) => {
    const nestedElement = $(nested);
    const nestedId = nestedElement.attr("id");
    const nestedName = nestedElement.is("a") ? nestedElement.attr("name") : null;

    if (nestedId) {
      ids.add(nestedId);
    }

    if (nestedName) {
      ids.add(nestedName);
    }
  });

  return ids;
}

function sliceOutline(
  outline: DocumentOutline,
  startAnchor: string | null,
  endAnchor: string | null
): string {
  if (!outline.blocks.length) {
    return "";
  }

  let startIndex = 0;
  if (startAnchor) {
    const anchoredIndex = outline.blocks.findIndex((block) => block.anchorIds.has(startAnchor));
    if (anchoredIndex >= 0) {
      startIndex = anchoredIndex;
    }
  }

  let endIndex = outline.blocks.length;
  if (endAnchor) {
    const anchoredEndIndex = outline.blocks.findIndex(
      (block, index) => index > startIndex && block.anchorIds.has(endAnchor)
    );
    if (anchoredEndIndex > startIndex) {
      endIndex = anchoredEndIndex;
    }
  }

  // If we failed to find a clean end boundary, we would rather over-include than
  // emit an empty section file, because empty output is harder to debug downstream.
  const sliced = outline.blocks.slice(startIndex, endIndex);
  return sliced.map((block) => block.html).join("\n");
}

function isMeaningfulDocument(text: string, archivePath: string, blockCount: number): boolean {
  if (text.length >= 40) {
    return true;
  }

  if (blockCount > 1 && text.length >= 10) {
    return true;
  }

  // This keeps decorative wrappers, blank title pages, and other near-empty files
  // from becoming output sections unless the EPUB explicitly points at them.
  return !/(cover|titlepage|title-page|copyright|blank)/i.test(slugify(archivePath));
}

/**
 * This file is the archive-reading layer of the system. It exists separately from
 * the section builder and markdown writer because opening an EPUB is a distinct
 * responsibility: we need to understand the publication package, manifest, spine,
 * and navigation metadata before we can decide how to split the book into files.
 * It talks downward to `JSZip`, `fast-xml-parser`, and `cheerio`, and upward to
 * the rest of the application by returning a normalized `ParsedEpub` object.
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { Element } from "domhandler";

import type {
  BookMetadata,
  ManifestItem,
  NavItem,
  ParsedEpub,
  SemanticReference,
  SpineDocument,
  SpineItem
} from "./types.js";
import {
  collapseWhitespace,
  ensureArray,
  pickFirstText,
  resolveArchivePath,
  splitHref
} from "./utils.js";

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false
});

const XHTML_MEDIA_TYPES = new Set([
  "application/xhtml+xml",
  "application/html+xml",
  "text/html"
]);

export async function parseEpub(inputPath: string): Promise<ParsedEpub> {
  const inputBuffer = await readFile(inputPath);
  const zip = await JSZip.loadAsync(inputBuffer);
  const inputName = basename(inputPath);

  // The container file tells us where the real package document lives, which is
  // the point where an EPUB stops being "just a zip" and becomes a publication.
  const containerXml = await readRequiredTextFile(zip, "META-INF/container.xml");
  const containerDocument = xmlParser.parse(containerXml) as Record<string, unknown>;
  const containerNode = containerDocument.container as Record<string, unknown> | undefined;
  const rootfilesNode = containerNode?.rootfiles as Record<string, unknown> | undefined;
  const rootFile = ensureArray(
    rootfilesNode?.rootfile as Record<string, string> | Record<string, string>[] | undefined
  )[0];

  if (!rootFile?.["full-path"]) {
    throw new Error("The EPUB container does not declare a package document.");
  }

  const packagePath = rootFile["full-path"];
  const packageXml = await readRequiredTextFile(zip, packagePath);
  const packageDocument = xmlParser.parse(packageXml) as Record<string, unknown>;
  const packageNode = packageDocument.package as Record<string, unknown> | undefined;

  if (!packageNode) {
    throw new Error("The EPUB package document could not be parsed.");
  }

  const metadata = parseMetadata(packageNode.metadata as Record<string, unknown> | undefined, inputName);
  const manifestItems = parseManifest(
    packageNode.manifest as Record<string, unknown> | undefined,
    packagePath
  );
  const manifestById = new Map(manifestItems.map((item) => [item.id, item]));
  const manifestByPath = new Map(manifestItems.map((item) => [item.archivePath, item]));
  const spine = parseSpine(packageNode.spine as Record<string, unknown> | undefined);

  const navDocument = await parseNavigationDocument(zip, manifestItems, packagePath);
  const ncxItems = navDocument.navItems.length
    ? []
    : await parseNcxNavigation(zip, manifestItems, packageNode.spine as Record<string, unknown> | undefined, packagePath);

  const guideReferences = parseGuide(
    packageNode.guide as Record<string, unknown> | undefined,
    packagePath
  );
  const spineDocuments = await readSpineDocuments(zip, manifestById, spine);

  return {
    inputPath,
    inputName,
    zip,
    packagePath,
    rootDirectory: packagePath.includes("/") ? packagePath.slice(0, packagePath.lastIndexOf("/")) : "",
    metadata,
    manifestItems,
    manifestById,
    manifestByPath,
    spine,
    navItems: navDocument.navItems.length ? navDocument.navItems : ncxItems,
    landmarks: navDocument.landmarks,
    guideReferences,
    spineDocuments
  };
}

async function readSpineDocuments(
  zip: JSZip,
  manifestById: Map<string, ManifestItem>,
  spine: SpineItem[]
): Promise<SpineDocument[]> {
  const documents: SpineDocument[] = [];

  for (const spineItem of spine) {
    const manifestItem = manifestById.get(spineItem.idref);
    if (!manifestItem || !spineItem.linear || !XHTML_MEDIA_TYPES.has(manifestItem.mediaType)) {
      continue;
    }

    // We load the textual spine documents up front because everything else in the
    // pipeline depends on having the reading order in memory and easy to slice.
    const content = await readRequiredTextFile(zip, manifestItem.archivePath);
    documents.push({
      id: manifestItem.id,
      href: manifestItem.href,
      archivePath: manifestItem.archivePath,
      mediaType: manifestItem.mediaType,
      content
    });
  }

  return documents;
}

function parseMetadata(
  metadataNode: Record<string, unknown> | undefined,
  inputName: string
): BookMetadata {
  const title =
    pickFirstText(metadataNode?.title) ??
    pickFirstText(metadataNode?.["dc:title"]) ??
    inputName.replace(/\.epub$/i, "");

  const author =
    pickFirstText(metadataNode?.creator) ?? pickFirstText(metadataNode?.["dc:creator"]);
  const language =
    pickFirstText(metadataNode?.language) ?? pickFirstText(metadataNode?.["dc:language"]);

  return {
    title,
    author,
    language
  };
}

function parseManifest(
  manifestNode: Record<string, unknown> | undefined,
  packagePath: string
): ManifestItem[] {
  const items = ensureArray(manifestNode?.item as Record<string, string> | Record<string, string>[] | undefined);

  return items
    .map((item) => {
      const href = item.href;
      const id = item.id;
      const mediaType = item["media-type"];

      if (!href || !id || !mediaType) {
        return null;
      }

      return {
        id,
        href,
        archivePath: resolveArchivePath(packagePath, href),
        mediaType,
        properties: (item.properties ?? "").split(/\s+/).filter(Boolean)
      } satisfies ManifestItem;
    })
    .filter((item): item is ManifestItem => item !== null);
}

function parseSpine(spineNode: Record<string, unknown> | undefined): SpineItem[] {
  const itemRefs = ensureArray(spineNode?.itemref as Record<string, string> | Record<string, string>[] | undefined);

  return itemRefs
    .map((itemRef) => {
      if (!itemRef.idref) {
        return null;
      }

      return {
        idref: itemRef.idref,
        linear: itemRef.linear !== "no"
      } satisfies SpineItem;
    })
    .filter((item): item is SpineItem => item !== null);
}

async function parseNavigationDocument(
  zip: JSZip,
  manifestItems: ManifestItem[],
  packagePath: string
): Promise<{ navItems: NavItem[]; landmarks: SemanticReference[] }> {
  const navManifestItem = manifestItems.find((item) => item.properties.includes("nav"));

  if (!navManifestItem) {
    return { navItems: [], landmarks: [] };
  }

  const navHtml = await readRequiredTextFile(zip, navManifestItem.archivePath);
  const $ = cheerio.load(navHtml, { xmlMode: false });

  let navItems: NavItem[] = [];
  let landmarks: SemanticReference[] = [];

  $("nav").each((_, element) => {
    const navElement = $(element);
    const navType = collapseWhitespace(
      [
        navElement.attr("epub:type"),
        navElement.attr("type"),
        navElement.attr("role"),
        navElement.attr("aria-label")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    );

    // EPUB 3 often puts both the main table of contents and the landmarks list in
    // the same document, so we inspect every nav node instead of assuming only one.
    if (!navItems.length && navType.includes("toc")) {
      navItems = parseHtmlNavItems($, navElement, navManifestItem.archivePath, packagePath);
    }

    if (navType.includes("landmarks")) {
      landmarks = parseLandmarks($, navElement, navManifestItem.archivePath, packagePath);
    }
  });

  return { navItems, landmarks };
}

function parseHtmlNavItems(
  $: CheerioAPI,
  navElement: Cheerio<Element>,
  navArchivePath: string,
  packagePath: string
): NavItem[] {
  const list = navElement.children("ol, ul").first();
  if (!list.length) {
    return [];
  }

  return list
    .children("li")
    .toArray()
    .map<NavItem | null>((item, index) => {
      const itemNode = $(item);
      const link = itemNode.children("a, span").first();
      const label = collapseWhitespace(link.text());
      const href = link.is("a") ? link.attr("href") ?? "" : "";
      const resolved = href ? resolveArchivePath(navArchivePath, href) : null;
      const { anchor } = splitHref(href);

      if (!label || !href) {
        return null;
      }

      return {
        label,
        href,
        archivePath: resolved,
        anchor,
        order: index
      };
    })
    .filter(isPresent);
}

function parseLandmarks(
  $: CheerioAPI,
  navElement: Cheerio<Element>,
  navArchivePath: string,
  packagePath: string
): SemanticReference[] {
  return navElement
    .find("a")
    .toArray()
    .map<SemanticReference | null>((anchor) => {
      const link = $(anchor);
      const href = link.attr("href") ?? "";
      const semanticType = link.attr("epub:type") ?? link.attr("type") ?? "";
      const label = collapseWhitespace(link.text()) || null;
      const { anchor: fragment } = splitHref(href);

      if (!href || !semanticType) {
        return null;
      }

      return {
        type: semanticType.toLowerCase(),
        label,
        href,
        archivePath: resolveArchivePath(navArchivePath, href),
        anchor: fragment
      };
    })
    .filter(isPresent);
}

async function parseNcxNavigation(
  zip: JSZip,
  manifestItems: ManifestItem[],
  spineNode: Record<string, unknown> | undefined,
  packagePath: string
): Promise<NavItem[]> {
  const spineTocId = typeof spineNode?.toc === "string" ? spineNode.toc : null;
  const ncxManifestItem =
    (spineTocId ? manifestItems.find((item) => item.id === spineTocId) : undefined) ??
    manifestItems.find((item) => item.mediaType === "application/x-dtbncx+xml");

  if (!ncxManifestItem) {
    return [];
  }

  const ncxXml = await readRequiredTextFile(zip, ncxManifestItem.archivePath);
  const ncxDocument = xmlParser.parse(ncxXml) as Record<string, unknown>;
  const navMap = (ncxDocument.ncx as Record<string, unknown> | undefined)?.navMap as
    | Record<string, unknown>
    | undefined;

  const navPoints = ensureArray(navMap?.navPoint as Record<string, unknown> | Record<string, unknown>[] | undefined);

  return navPoints
    .map<NavItem | null>((navPoint, index) => {
      const label =
        pickFirstText((navPoint.navLabel as Record<string, unknown> | undefined)?.text) ?? "";
      const href = ((navPoint.content as Record<string, string> | undefined)?.src ?? "").trim();
      const { anchor } = splitHref(href);

      if (!label || !href) {
        return null;
      }

      return {
        label,
        href,
        archivePath: resolveArchivePath(ncxManifestItem.archivePath, href),
        anchor,
        order: index
      };
    })
    .filter(isPresent);
}

function parseGuide(
  guideNode: Record<string, unknown> | undefined,
  packagePath: string
): SemanticReference[] {
  const references = ensureArray(
    guideNode?.reference as Record<string, string> | Record<string, string>[] | undefined
  );

  return references
    .map<SemanticReference | null>((reference) => {
      const href = reference.href;
      const type = reference.type;
      const { anchor } = splitHref(href ?? "");

      if (!href || !type) {
        return null;
      }

      return {
        type: type.toLowerCase(),
        label: reference.title ? collapseWhitespace(reference.title) : null,
        href,
        archivePath: resolveArchivePath(packagePath, href),
        anchor
      };
    })
    .filter(isPresent);
}

async function readRequiredTextFile(zip: JSZip, archivePath: string): Promise<string> {
  const zipEntry = zip.file(archivePath);

  if (!zipEntry) {
    throw new Error(`The EPUB is missing the file "${archivePath}".`);
  }

  return zipEntry.async("text");
}

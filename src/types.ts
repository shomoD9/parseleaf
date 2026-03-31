/**
 * This file names the core objects that move through the EPUB conversion pipeline.
 * It exists separately so the parser, sectioning logic, markdown conversion, CLI,
 * and tests can all speak the same language without smuggling structure through
 * ad hoc object literals. It imports the `JSZip` type because the parsed EPUB keeps
 * the opened archive around, and the rest of the system imports these types to
 * describe what each phase receives and returns.
 */

import type JSZip from "jszip";

export type SectionType =
  | "toc"
  | "preface"
  | "foreword"
  | "introduction"
  | "chapter"
  | "appendix"
  | "notes"
  | "bibliography"
  | "index"
  | "acknowledgments"
  | "title-page"
  | "cover"
  | "section";

export interface BookMetadata {
  title: string;
  author: string | null;
  language: string | null;
}

export interface ManifestItem {
  id: string;
  href: string;
  archivePath: string;
  mediaType: string;
  properties: string[];
}

export interface SpineItem {
  idref: string;
  linear: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  archivePath: string | null;
  anchor: string | null;
  order: number;
}

export interface SemanticReference {
  type: string;
  label: string | null;
  href: string;
  archivePath: string | null;
  anchor: string | null;
}

export interface SpineDocument {
  id: string;
  href: string;
  archivePath: string;
  mediaType: string;
  content: string;
}

export interface ParsedEpub {
  inputPath: string;
  inputName: string;
  zip: JSZip;
  packagePath: string;
  rootDirectory: string;
  metadata: BookMetadata;
  manifestItems: ManifestItem[];
  manifestById: Map<string, ManifestItem>;
  manifestByPath: Map<string, ManifestItem>;
  spine: SpineItem[];
  navItems: NavItem[];
  landmarks: SemanticReference[];
  guideReferences: SemanticReference[];
  spineDocuments: SpineDocument[];
}

export interface SectionPart {
  archivePath: string;
  href: string;
  html: string;
  startAnchor: string | null;
  endAnchor: string | null;
}

export interface SectionPlan {
  order: number;
  title: string;
  navLabel: string;
  sectionType: SectionType;
  sourceAnchor: string | null;
  sourceHrefs: string[];
  sourceArchivePaths: string[];
  parts: SectionPart[];
}

export interface AssetRecord {
  sourcePath: string;
  outputPath: string;
  mediaType: string | null;
}

export interface ConvertedSection {
  order: number;
  fileName: string;
  title: string;
  navLabel: string;
  sectionType: SectionType;
  markdown: string;
  sourceAnchor: string | null;
  sourceHrefs: string[];
  sourceArchivePaths: string[];
  assets: AssetRecord[];
}

export interface OutputManifest {
  book: {
    title: string;
    author: string | null;
    language: string | null;
    slug: string;
    inputFile: string;
  };
  generatedAt: string;
  sections: Array<{
    order: number;
    file: string;
    title: string;
    navLabel: string;
    sectionType: SectionType;
    sourceAnchor: string | null;
    sourceHrefs: string[];
    sourceArchivePaths: string[];
    assets: AssetRecord[];
  }>;
  assets: AssetRecord[];
}

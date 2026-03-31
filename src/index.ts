/**
 * This file is the orchestration seam for the whole tool. It exists separately so
 * the CLI can stay thin while tests and other callers can invoke the conversion
 * pipeline directly as a function. It talks to the EPUB parser, the sectioning
 * layer, and the output writer, and it returns a concise description of where the
 * converted book ended up on disk.
 */

import path from "node:path";

import { writeOutput } from "./output.js";
import { parseEpub } from "./parse-epub.js";
import { buildSections } from "./sectioning.js";
import type { OutputManifest } from "./types.js";
import { slugify } from "./utils.js";

export interface ConvertOptions {
  inputPath: string;
  outputDirectory?: string;
}

export interface ConvertResult {
  outputDirectory: string;
  manifest: OutputManifest;
}

export async function convertEpub(options: ConvertOptions): Promise<ConvertResult> {
  const parsed = await parseEpub(options.inputPath);

  // The output location defaults to a stable slug so repeated runs for the same
  // book naturally land in a predictable folder when no custom path is given.
  const outputDirectory =
    options.outputDirectory ??
    path.resolve(process.cwd(), "output", slugify(parsed.metadata.title));
  const sections = buildSections(parsed);

  if (!sections.length) {
    throw new Error("No meaningful sections could be inferred from the EPUB.");
  }

  return writeOutput(parsed, sections, outputDirectory);
}

export type { OutputManifest, SectionPlan } from "./types.js";

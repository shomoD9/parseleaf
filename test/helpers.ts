/**
 * This file builds throwaway EPUB archives from the committed fixture directories.
 * It exists separately so the tests can describe book behavior in terms of small,
 * readable source files instead of opaque binary blobs, while still exercising the
 * real ZIP-based parser. It talks to the fixture files on disk, to `JSZip` for
 * archive assembly, and to the main conversion function for end-to-end testing.
 */

import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

import { convertEpub } from "../src/index.js";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

// We resolve fixtures relative to this file so repository renames do not bake an
// old project name into the test suite or make the helpers machine-specific.
const FIXTURES_ROOT = path.resolve(TEST_DIRECTORY, "fixtures");

export async function buildFixtureEpub(fixtureName: string): Promise<string> {
  const fixtureDirectory = path.join(FIXTURES_ROOT, fixtureName);
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "parseleaf-fixture-"));
  const epubPath = path.join(tempDirectory, `${fixtureName}.epub`);
  const zip = new JSZip();

  // We copy the committed fixture tree into an in-memory ZIP so the parser sees a
  // real EPUB container while the test inputs stay transparent and editable.
  await addDirectoryToZip(zip, fixtureDirectory, fixtureDirectory);

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE"
  });

  await writeFile(epubPath, buffer);
  return epubPath;
}

export async function convertFixture(fixtureName: string): Promise<{
  epubPath: string;
  outputDirectory: string;
  manifestPath: string;
}> {
  const epubPath = await buildFixtureEpub(fixtureName);
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "parseleaf-output-"));
  await convertEpub({ inputPath: epubPath, outputDirectory });

  return {
    epubPath,
    outputDirectory,
    manifestPath: path.join(outputDirectory, "manifest.json")
  };
}

export async function cleanupTempPath(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true });
}

async function addDirectoryToZip(
  zip: JSZip,
  rootDirectory: string,
  currentDirectory: string
): Promise<void> {
  const entries = await readdir(currentDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(rootDirectory, absolutePath).split(path.sep).join("/");

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, rootDirectory, absolutePath);
      continue;
    }

    const fileBuffer = await readFile(absolutePath);
    zip.file(relativePath, fileBuffer, {
      // The EPUB spec prefers an uncompressed mimetype entry at the root. Our
      // parser does not depend on that nuance, but the helper keeps the fixture
      // archives closer to how real EPUBs are usually packaged.
      compression: relativePath === "mimetype" ? "STORE" : "DEFLATE"
    });
  }
}

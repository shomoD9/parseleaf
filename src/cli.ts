#!/usr/bin/env node
/**
 * This file is the command-line entrypoint. It exists separately so the public
 * interface stays small and obvious: parse the user’s arguments, call the core
 * conversion function, and report either the output location or the failure. It
 * talks only to Node’s argument parser, the orchestrator in `index.ts`, and the
 * terminal via stdout and stderr.
 */

import { parseArgs } from "node:util";

import { convertEpub } from "./index.js";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: {
        type: "string"
      },
      help: {
        type: "boolean",
        short: "h"
      }
    }
  });

  if (values.help || positionals.length === 0) {
    printUsage();
    return;
  }

  const [command, inputPath] = positionals;

  if (command !== "convert" || !inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  // The CLI does almost no work itself; it exists to turn a human command into
  // a call into the shared conversion pipeline and to report the outcome clearly.
  const result = await convertEpub(
    values.out
      ? {
          inputPath,
          outputDirectory: values.out
        }
      : {
          inputPath
        }
  );

  process.stdout.write(`Converted EPUB into ${result.outputDirectory}\n`);
}

function printUsage(): void {
  process.stdout.write(
    "Usage: parseleaf convert <input.epub> [--out <directory>]\n"
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`parseleaf: ${message}\n`);
  process.exitCode = 1;
});

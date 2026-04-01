#!/usr/bin/env node
/**
 * This file renders the Homebrew formula that lives in Parseleaf's dedicated
 * tap repository. It exists separately so the release workflow can generate one
 * authoritative formula from release metadata instead of hand-assembling Ruby in
 * a shell step. It talks to the release job through command-line arguments and
 * writes a complete `parseleaf.rb` file whose architecture-specific URLs and
 * checksums match the binaries attached to the GitHub Release.
 */

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "../..");

function requireArgument(name) {
  const flagIndex = process.argv.indexOf(name);
  const value = flagIndex === -1 ? null : process.argv[flagIndex + 1] ?? null;

  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }

  return value;
}

async function main() {
  const version = requireArgument("--version");
  const arm64Url = requireArgument("--arm64-url");
  const arm64Sha = requireArgument("--arm64-sha256");
  const x64Url = requireArgument("--x64-url");
  const x64Sha = requireArgument("--x64-sha256");
  const outputPath = requireArgument("--output");
  const formula = `# This formula installs the standalone Parseleaf binary from the
# tagged GitHub Release assets produced by the main repository's release
# workflow. It exists in the dedicated tap so Homebrew users can install
# Parseleaf without having Node installed on their machine.
class Parseleaf < Formula
  desc "Convert EPUB publications into semantically structured markdown for AI workflows"
  homepage "https://github.com/shomoD9/parseleaf"
  version "${version}"
  license "MIT"

  on_macos do
    on_arm do
      url "${arm64Url}"
      sha256 "${arm64Sha}"
    end

    on_intel do
      url "${x64Url}"
      sha256 "${x64Sha}"
    end
  end

  def install
    # The release tarball contains exactly one executable, so installation is
    # just moving that binary into Homebrew's managed bin directory.
    bin.install "parseleaf"
  end

  test do
    # We keep the smoke test minimal and stable: if the binary can boot and
    # report its usage contract, the release artifact is wired correctly.
    output = shell_output("#{bin}/parseleaf --help")
    assert_match "Usage: parseleaf convert", output
  end
end
`;

  await writeFile(outputPath, formula, "utf8");
  process.stdout.write(`${outputPath.replace(`${projectRoot}/`, "")}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`render-homebrew-formula: ${message}\n`);
  process.exitCode = 1;
});

# Parseleaf

`Parseleaf` is the project name. The current shipped tool is `Parseleaf CLI`, a local command-line tool that opens an EPUB, interprets the book's semantic structure, and writes a directory of markdown files that preserve the major sections of the publication. The intended output is clean enough for human reading, but the system is primarily optimized for downstream AI and knowledge-processing workflows where one chapter or front-matter section per file is more useful than one giant text dump.

The larger product direction is broader than EPUB alone: Parseleaf is about taking text and making it AI-usable. Right now, that idea is embodied as an EPUB-first CLI.

## Install

Install from npm when you already have Node 22:

```bash
npm install -g parseleaf
```

Install from Homebrew on macOS when you want a standalone binary:

```bash
brew install shomoD9/parseleaf/parseleaf
```

The npm package keeps Node as the runtime. The Homebrew package installs a prebuilt Parseleaf binary and does not require Node on the target machine.

The CLI contract is:

```bash
parseleaf convert path/to/book.epub
parseleaf convert path/to/book.epub --out ./custom-output
```

If `--out` is omitted, the tool writes into `./output/<book-slug>/`. Each output directory contains numbered markdown files, an `assets/` directory for extracted images and related resources, and a `manifest.json` file that records the generated section order and source mappings.

## Releases

Parseleaf releases are cut from semver Git tags in the main repository, such as `v0.1.0`. The release workflow publishes the npm package, builds macOS standalone binaries, attaches those binaries to the GitHub Release, and updates the dedicated Homebrew tap.

This repository is intentionally narrated. `ARCHITECTURE.md` explains the system as a whole, and the source files explain themselves in prose so the project can be read as a coherent structure instead of a pile of implementation details.

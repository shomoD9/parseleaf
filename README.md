# Parseleaf

Parseleaf turns EPUB books into clean, semantically structured Markdown for AI workflows.

Instead of flattening a book into one giant text dump, Parseleaf keeps the publication's structure intact. Chapters stay separate. Front matter stays separate. Appendices, notes, and assets stay traceable. The result is easier to read, easier to search, and much easier to feed into embeddings, retrieval pipelines, agent tools, and other downstream systems.

Right now Parseleaf ships as an EPUB-first CLI. The broader project direction is larger: take text and make it AI-usable.

## Why Parseleaf

- Preserves chapter and section boundaries instead of emitting one monolithic file
- Extracts assets and keeps links stable in the generated workspace
- Writes YAML frontmatter and a machine-readable `manifest.json`
- Produces output that works for both humans and downstream software
- Handles EPUB 3 navigation, EPUB 2 NCX fallbacks, and degraded books with weak structure

## Install

Use npm if you already have Node 22:

```bash
npm install -g parseleaf
```

Use Homebrew on macOS if you want a standalone binary:

```bash
brew install shomoD9/parseleaf/parseleaf
```

## Quick Start

Convert an EPUB:

```bash
parseleaf convert path/to/book.epub
```

Write the output to a custom directory:

```bash
parseleaf convert path/to/book.epub --out ./my-output
```

If `--out` is omitted, Parseleaf writes to:

```text
./output/<book-slug>/
```

## What You Get

A successful run produces a structured workspace that looks roughly like this:

```text
output/the-book/
  01-contents.md
  02-preface.md
  03-chapter-1.md
  04-appendix-a.md
  assets/
  manifest.json
```

Each Markdown file contains YAML frontmatter with source metadata. `manifest.json` records the generated order, section titles, source mappings, and extracted assets.

## Example

```bash
parseleaf convert ./books/the-idea.epub --out ./parsed/the-idea
```

Example result:

```text
parsed/the-idea/
  01-contents.md
  02-introduction.md
  03-chapter-1-the-river.md
  04-notes.md
  assets/
  manifest.json
```

## Current Scope

Parseleaf currently focuses on EPUB input and Markdown output. The CLI is intentionally small:

```text
parseleaf convert <input.epub> [--out <directory>]
```

That narrow scope is deliberate. The job of the tool is not to be a general ebook reader or a visual converter. Its job is to preserve semantic structure and produce files that are useful in AI and knowledge-processing systems.

## Development

Clone the repository, install dependencies, and run the test suite:

```bash
npm install
npm test
```

Build the CLI locally:

```bash
npm run build
```

Check the publishable package contents:

```bash
npm run pack:check
```

## Releases

Releases are cut from semver Git tags such as `v0.1.0`. The release workflow:

- validates the npm package
- builds macOS standalone binaries
- publishes release assets to GitHub Releases
- updates the Homebrew tap

## Project Notes

This repository is intentionally narrated. [ARCHITECTURE.md](./ARCHITECTURE.md) explains the system as a coherent whole, and [DEVLOG.md](./DEVLOG.md) keeps a running record of development activity.

## License

[MIT](./LICENSE)

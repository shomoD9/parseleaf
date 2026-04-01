# Parseleaf

Parseleaf turns ebooks into clean, semantically structured Markdown workspace so that you can operationalise its content, themes and ideas with AI.

If you give an AI an ebook as one giant blob of text, it does not really encounter the book as a book. Chapters, prefaces, appendices, notes, and internal references all get flattened together. That makes it much harder for the model to follow the structure of the argument, answer precise questions, or stay grounded in where an idea came from.

Parseleaf preserves that structure instead of destroying it. It reads the EPUB properly, splits it into meaningful sections, keeps notes and internal links intact, extracts relevant assets, and writes everything out in a form an AI can work with directly. The output is essentially the book behaving like a markdown wiki.

The result is easier to read, easier to search, and much easier to feed into embeddings, retrieval pipelines, agent tools, and other downstream systems.

That makes a bunch of real use cases much better:
building structured notes, extracting methods or concepts, turning the content into reusable skills and workflows, using the principles from the book for decision intelligence, etc.

Right now Parseleaf ships as a CLI tool that creates a markdown workspace from your EPUBs. The broader project direction is to take any form of media and make it AI-usable.

## Why Parseleaf

- Preserves chapter and section boundaries instead of emitting one monolithic file
- Extracts assets and keeps links stable in the generated workspace
- Writes YAML frontmatter and a machine-readable `manifest.json`
- Produces output that works for both humans and downstream software
- Handles EPUB 3 navigation, EPUB 2 NCX fallbacks, and degraded books with weak structure

## Install

NPM:

```bash
npm install -g parseleaf
```

Homebrew:

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

Without `--out`, Parseleaf writes to:

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

## License

[MIT](./LICENSE)

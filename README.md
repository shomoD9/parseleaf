# Parseleaf

`Parseleaf` is the project name. The current shipped tool is `Parseleaf CLI`, a local command-line tool that opens an EPUB, interprets the book's semantic structure, and writes a directory of markdown files that preserve the major sections of the publication. The intended output is clean enough for human reading, but the system is primarily optimized for downstream AI and knowledge-processing workflows where one chapter or front-matter section per file is more useful than one giant text dump.

The larger product direction is broader than EPUB alone: Parseleaf is about taking text and making it AI-usable. Right now, that idea is embodied as an EPUB-first CLI.

The CLI contract is:

```bash
parseleaf convert path/to/book.epub
parseleaf convert path/to/book.epub --out ./custom-output
```

If `--out` is omitted, the tool writes into `./output/<book-slug>/`. Each output directory contains numbered markdown files, an `assets/` directory for extracted images and related resources, and a `manifest.json` file that records the generated section order and source mappings.

This repository is intentionally narrated. `ARCHITECTURE.md` explains the system as a whole, and the source files explain themselves in prose so the project can be read as a coherent structure instead of a pile of implementation details.

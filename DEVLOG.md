# Devlog

## 2026-04-01

Created the initial `ARCHITECTURE.md` file to establish a narrative map of the empty repository before implementation began, in keeping with the repo instructions. Created this `DEVLOG.md` file to start the continuous record of development activity.

Added the Node and TypeScript project scaffold: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, and `README.md`. Installed the runtime and development dependencies required for EPUB parsing, markdown conversion, testing, and compilation.

Implemented the main source modules under `src/`: shared types in `src/types.ts`, path and naming helpers in `src/utils.ts`, EPUB package parsing in `src/parse-epub.ts`, semantic section inference in `src/sectioning.ts`, HTML cleanup and markdown conversion in `src/markdown.ts`, filesystem output writing in `src/output.ts`, orchestration in `src/index.ts`, the CLI entrypoint in `src/cli.ts`, and the local Turndown type declaration in `src/turndown.d.ts`.

Created fixture books and tests under `test/`. Added `test/helpers.ts` to build temporary EPUB archives from readable fixture trees. Added `test/utils.test.ts`, `test/sectioning.test.ts`, and `test/convert.test.ts`. Added EPUB 3, EPUB 2, and degraded fixture source trees under `test/fixtures/` to exercise semantic TOC splitting, NCX fallback, multi-file chapter merging, asset extraction, and degraded spine-based fallback behavior.

Ran `npm test`, found that section boundaries were incorrectly spilling into the next document, and patched `src/sectioning.ts` so a section stops before the next spine document unless both boundaries live inside the same XHTML file. Adjusted the integration tests to assert the manifest fields that matter while still allowing the richer manifest shape produced by the implementation.

Ran `npm run build`, found strict TypeScript issues around exact optional properties, Cheerio typings, Turndown declarations, and no-undefined array access, then patched the relevant files until the build passed cleanly. Ran `npm run build` again successfully. Performed a final smoke test by generating a fixture EPUB from the compiled test helper and running the compiled CLI against it.

Rewrote `ARCHITECTURE.md` so it now reflects the actual repository rather than the empty starting state.

Reviewed the repository framing to support a naming consultation. Read `README.md`, `package.json`, `ARCHITECTURE.md`, and the main pipeline files to confirm that the product is best described as a system that turns EPUB books into semantically separated markdown workspaces for downstream AI and knowledge-processing workflows. Used that framing to develop naming guidance that favors communicative utility over a purely evocative brand name.

Refined the naming thesis after clarifying the broader product philosophy: the long-term system is not only about books, but about taking any text and making it AI-usable. Shifted the naming exploration away from book-specific framing toward names that can support a general ingestion, structuring, and agent-facing platform across CLI tools, GUI surfaces, and skills.

Committed to `Parseleaf` as the official project name and to `Parseleaf CLI` as the name of the currently shipped command-line tool. Updated `package.json` and `package-lock.json` so the package name is now `parseleaf`, the executable surface is `parseleaf`, and the package description and keywords better reflect the public identity that will be used when a GitHub remote is created.

Rewrote the public-facing copy in `README.md` so it distinguishes the broader Parseleaf project from the current EPUB-first CLI, and updated `ARCHITECTURE.md` so the opening, geography, and flow sections now narrate the same naming model. Patched `src/cli.ts` so the usage text and error prefix expose the new `parseleaf` command name.

Updated `test/helpers.ts` to resolve fixture paths relative to the file instead of hardcoding the repository’s old folder name, and renamed the temporary test output prefixes to `parseleaf-*` so the rename does not leave stale machine-specific assumptions inside the suite.

Ran `npm test` successfully, ran `npm run build` successfully, verified that no `book-to-skill` references remain in the authored source or generated `dist/` output, and confirmed that `node dist/src/cli.js --help` now prints the `parseleaf` usage string.

Initialized a local Git repository for Parseleaf after the GitHub remote was created, then updated `package.json` so the package metadata now points at `git@github.com:shomoD9/parseleaf.git` over SSH while still exposing the HTTPS homepage and issues URLs that package registries and repository viewers expect. Updated `ARCHITECTURE.md` so the repository-root narrative matches that new public metadata.

Attempted to write the local Git remote and default branch configuration, hit sandbox restrictions on `.git/config`, and prepared to retry those Git configuration steps with elevated permissions rather than leaving the repository half-wired.

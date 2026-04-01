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

Implemented the first real packaging and release layer for Parseleaf. Added MIT licensing in `LICENSE`, hardened `package.json` with a curated `files` allowlist, `publishConfig`, `prepack`, `pack:check`, and `build:sea` scripts, expanded the install and release documentation in `README.md`, and updated `.gitignore` so release workspaces and local tarballs do not pollute the repository.

Installed the new release-time development dependencies `esbuild` and `postject`, which are now locked in `package-lock.json`. Those tools are the core of the standalone binary path: `esbuild` flattens the CLI and its filesystem-loaded dependencies into one CommonJS entry file, and `postject` injects the generated SEA blob into a copied `node` executable.

Added `scripts/release/build-sea.mjs` and `scripts/release/render-homebrew-formula.mjs`. The first script builds a standalone SEA binary for the current platform, re-signs the macOS executable, and packages it as a release tarball. The second script turns release metadata into the exact `parseleaf.rb` formula that the dedicated `homebrew-parseleaf` tap should publish.

Added `.github/workflows/release.yml` to automate the end-to-end release path. The workflow now validates the npm package from a tag, builds macOS arm64 and x64 SEA binaries, attaches release assets and checksums to GitHub Releases, publishes `parseleaf` to npm with provenance under GitHub OIDC trusted publishing, verifies the generated Homebrew formula on clean macOS runners, and then updates the dedicated Homebrew tap using the `HOMEBREW_TAP_TOKEN` secret.

Ran a full local verification pass for the new packaging system. `npm test` passed. `npm run build` passed. `npm run pack:check` passed and confirmed that the npm tarball is now curated down to the runnable distribution plus `README.md` and `LICENSE`. Rendered a sample Homebrew formula with `scripts/release/render-homebrew-formula.mjs` and checked it with `ruby -c`. Ran `npm run build:sea -- --output-dir /tmp/parseleaf-sea` successfully, verified that the resulting standalone binary reports the expected help text, and then used that standalone binary to convert a freshly zipped EPUB fixture into a markdown workspace with a generated `manifest.json`.

Rewrote `ARCHITECTURE.md` so the system map now includes the new release subsystem, the `.github/workflows/` automation, the `scripts/release/` helpers, the dual npm-plus-SEA build model, and the release flow that ends in GitHub Releases and the Homebrew tap.

Triggered the first tagged release with `v0.1.0` and inspected the GitHub Actions failure. The release workflow was failing in the npm tarball smoke-test step because `npm pack` prints prepack/build output before the tarball filename, so the shell variable was capturing the whole output block instead of just `parseleaf-0.1.0.tgz`. Patched `.github/workflows/release.yml` so the step now pipes `npm pack` through `tail -n 1`, updated `ARCHITECTURE.md` to describe that nuance in the release flow, and prepared the repository for a follow-up push so the release can be rerun cleanly.

Reran the release and found a second workflow issue in the Intel binary lane: GitHub Actions rejected the `macos-13` configuration for this repository with the message that `macos-13-us-default` is not supported. Patched `.github/workflows/release.yml` so the Intel macOS jobs now use `macos-15-intel` while the Apple Silicon jobs continue to use `macos-14`, and updated `ARCHITECTURE.md` so the release-flow narrative reflects the actual runner labels now used by the repository.

Ran the release again and found a third workflow issue in the Homebrew verification stage. Homebrew now rejects installing a standalone formula file outside a tap, so the CI step `brew install --formula "$RUNNER_TEMP/homebrew/parseleaf.rb"` was no longer valid. Patched `.github/workflows/release.yml` so the verification job now creates a throwaway local tap, copies `parseleaf.rb` into that tap's `Formula/` directory, installs `local/parseleaf-verify/parseleaf`, runs `brew test parseleaf`, and then untaps the temporary tap. Updated `ARCHITECTURE.md` so the release-flow narrative now describes that tap-based Homebrew verification model.

Reviewed the repository specifically to answer how to verify that Parseleaf is working properly. Read `package.json`, `README.md`, `src/cli.ts`, `src/index.ts`, `src/output.ts`, `test/helpers.ts`, and `test/convert.test.ts` to confirm the supported command surface and the existing verification story. Ran `node -v` and confirmed the local runtime is `v22.12.0`, ran `npm test` and confirmed all 9 tests pass, ran `npm run build` and confirmed the TypeScript build is clean, then performed a manual CLI smoke test by generating the `epub3` fixture as a temporary `.epub`, running `node dist/src/cli.js convert ... --out /tmp/parseleaf-manual-smoke`, and inspecting the generated markdown files, asset extraction, and `manifest.json`.

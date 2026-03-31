/**
 * This declaration file gives TypeScript just enough shape information for the
 * `turndown` package we use in the markdown layer. It exists because the package
 * ships without types in this setup, and the compiled CLI still needs to reason
 * about the constructor and rule API in a typed way.
 */

declare module "turndown" {
  interface TurndownOptions {
    headingStyle?: "setext" | "atx";
    bulletListMarker?: "-" | "*" | "+";
    codeBlockStyle?: "indented" | "fenced";
  }

  interface Rule {
    filter: string | string[] | ((node: Node, options?: unknown) => boolean);
    replacement: (content: string, node: Node, options?: unknown) => string;
  }

  export default class TurndownService {
    constructor(options?: TurndownOptions);
    addRule(key: string, rule: Rule): void;
    turndown(html: string | Node): string;
  }
}

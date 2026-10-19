/** Turns a CSS-escaped identifier (md\:flex, w-1\/2) into its literal form. */
export const unescapeCssIdentifier = (identifier: string): string =>
    identifier.replace(/\\(.)/g, '$1');

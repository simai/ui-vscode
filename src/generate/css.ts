/*
 * A small CSS reader for the built SIMAI Framework sheets. It understands
 * nested at-rules (@layer, @media, @supports) and plain style rules, which is
 * all the generator needs; it is not a general CSS parser.
 */

export interface CssRule {
    selector: string;
    /** Conditions of the enclosing @media rules, outermost first. */
    media: string[];
    declarations: [property: string, value: string][];
}

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Reads up to the next top-level `{`, `;` or `}`, skipping strings and
 * parentheses, and returns the index of that delimiter.
 */
function scan(text: string, start: number): number {
    let depth = 0;
    for (let index = start; index < text.length; index += 1) {
        const char = text[index];
        if (char === '\\') {
            index += 1;
        } else if (char === '"' || char === "'") {
            const end = text.indexOf(char, index + 1);
            index = end < 0 ? text.length : end;
        } else if (char === '(') {
            depth += 1;
        } else if (char === ')') {
            depth -= 1;
        } else if (depth === 0 && (char === '{' || char === ';' || char === '}')) {
            return index;
        }
    }
    return text.length;
}

export function parseCss(source: string): CssRule[] {
    const text = stripComments(source);
    const rules: CssRule[] = [];

    const readBlock = (start: number, media: string[], selector: string | null): number => {
        const declarations: [string, string][] = [];
        let index = start;
        while (index < text.length) {
            const end = scan(text, index);
            const prelude = text.slice(index, end).trim();
            const delimiter = text[end];
            if (delimiter === '{') {
                if (prelude.startsWith('@media')) {
                    index = readBlock(end + 1, [...media, prelude.slice(6).trim()], null);
                } else if (prelude.startsWith('@')) {
                    index = readBlock(end + 1, media, null);
                } else {
                    index = readBlock(end + 1, media, prelude.replace(/\s+/g, ' '));
                }
                continue;
            }
            if (prelude && selector !== null) {
                const colon = prelude.indexOf(':');
                if (colon > 0) {
                    declarations.push([
                        prelude.slice(0, colon).trim(),
                        prelude.slice(colon + 1).trim(),
                    ]);
                }
            }
            index = end + 1;
            if (delimiter === '}' || delimiter === undefined) break;
        }
        if (selector !== null) rules.push({ selector, media, declarations });
        return index;
    };

    readBlock(0, [], null);
    return rules;
}

/** Splits a comma-separated list at the top level (outside parentheses). */
export function splitTopLevel(value: string, separator = ','): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of value) {
        if (char === '(') depth += 1;
        if (char === ')') depth -= 1;
        if (char === separator && depth === 0) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    parts.push(current.trim());
    return parts;
}

export { unescapeCssIdentifier as unescapeCss } from '../registry/cssName';

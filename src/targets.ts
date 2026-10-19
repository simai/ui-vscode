/*
 * Finds the SIMAI Framework name under the cursor for hovers.
 */
import { detectCompletionRequest, isStylesheetLanguage } from './completion';
import { unescapeCssIdentifier } from './registry/cssName';
import { detectMarkupRequest } from './markup';

export type HoverTarget =
    | { kind: 'token'; name: string; start: number; end: number }
    | { kind: 'tag'; name: string; start: number; end: number }
    | { kind: 'attribute'; tag: string; name: string; start: number; end: number }
    | { kind: 'class'; name: string; start: number; end: number };

function covering(
    line: string,
    character: number,
    pattern: RegExp,
    group = 0,
): { text: string; start: number; end: number } | undefined {
    for (const match of line.matchAll(pattern)) {
        const text = match[group];
        const start = match.index! + match[0].indexOf(text);
        const end = start + text.length;
        if (character >= start && character <= end) return { text, start, end };
    }
    return undefined;
}

/**
 * @param textAbove document text from a few lines above up to the start of
 * `line`, so that tags spanning several lines are recognised.
 */
export function findHoverTarget(
    line: string,
    character: number,
    languageId: string,
    textAbove = '',
): HoverTarget | undefined {
    const token = covering(line, character, /--sf-(?:\\.|[A-Za-z0-9_-])+/g);
    if (token) return { kind: 'token', name: token.text, start: token.start, end: token.end };

    if (isStylesheetLanguage(languageId)) {
        const selector = covering(line, character, /\.((?:\\.|[A-Za-z0-9_-])+)/g, 1);
        if (selector) {
            return {
                kind: 'class',
                name: unescapeCssIdentifier(selector.text),
                start: selector.start,
                end: selector.end,
            };
        }
        return undefined;
    }

    const tag = covering(line, character, /<\/?(sf-[a-z0-9-]+)/g, 1);
    if (tag) return { kind: 'tag', name: tag.text, start: tag.start, end: tag.end };

    const word = covering(line, character, /[^\s"'<>=`{}]+/g);
    if (!word) return undefined;

    const classRequest = detectCompletionRequest(line, word.end, languageId);
    if (classRequest?.context === 'htmlClass' && classRequest.prefix === word.text) {
        return { kind: 'class', name: word.text, start: word.start, end: word.end };
    }

    const markup = detectMarkupRequest(textAbove + line.slice(0, word.start));
    if (markup?.kind === 'attribute' && /^[A-Za-z][A-Za-z0-9-]*$/.test(word.text)) {
        return {
            kind: 'attribute',
            tag: markup.tag,
            name: word.text,
            start: word.start,
            end: word.end,
        };
    }
    return undefined;
}

import { CompletionContext, RegistryEntry } from './registry/types';

export interface CompletionRequest {
    context: CompletionContext;
    prefix: string;
    replaceLength: number;
}

const htmlLanguages = new Set([
    'html',
    'javascript',
    'javascriptreact',
    'typescript',
    'typescriptreact',
    'vue',
    'react',
]);

export function detectCompletionRequest(
    line: string,
    cursor: number,
    languageId: string,
): CompletionRequest | undefined {
    const before = line.slice(0, cursor);

    if (htmlLanguages.has(languageId)) {
        const attribute = before.match(
            /(?:class|className)\s*=\s*(["'])([^"']*)$/,
        );
        if (attribute) {
            const prefix = attribute[2].match(/[^\s]*$/)?.[0] ?? '';
            return {
                context: 'htmlClass',
                prefix,
                replaceLength: prefix.length,
            };
        }
    }

    const cssVariable = before.match(/--[A-Za-z0-9_\\/:.-]*$/)?.[0];
    if (cssVariable !== undefined) {
        return {
            context: 'cssVariable',
            prefix: cssVariable,
            replaceLength: cssVariable.length,
        };
    }

    const classSelector = before.match(/\.([A-Za-z0-9_\\/:.-]*)$/)?.[1];
    if (classSelector !== undefined) {
        return {
            context: 'htmlClass',
            prefix: classSelector,
            replaceLength: classSelector.length,
        };
    }

    return undefined;
}

export function matchingEntries(
    entries: RegistryEntry[],
    request: CompletionRequest,
): RegistryEntry[] {
    const prefix = request.prefix.toLowerCase();
    return entries.filter(entry =>
        entry.completionContexts.includes(request.context)
        && (
            entry.cssName.toLowerCase().startsWith(prefix)
            || entry.aliases.some(alias => alias.toLowerCase().startsWith(prefix))
        ),
    );
}

export function completionLabel(
    entry: RegistryEntry,
    request: CompletionRequest,
): string {
    if (request.context === 'htmlClass') {
        const prefix = request.prefix.toLowerCase();
        return entry.aliases.find(
            alias => alias.toLowerCase().startsWith(prefix),
        ) ?? entry.cssName;
    }
    return entry.cssName;
}

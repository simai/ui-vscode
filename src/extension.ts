import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    completionLabel,
    detectCompletionRequest,
    matchingEntries,
} from './completion';
import { SfAutocompleteRegistry } from './registry/types';
import { validateRegistry } from './registry/validation';

// Activation runs at startup (onStartupFinished) so that the very first
// completion request already reaches this provider. Keep it cheap: the
// registry is read on first use, not during activation.
export function activate(context: vscode.ExtensionContext): void {
    let cachedRegistry: SfAutocompleteRegistry | undefined;
    const loadRegistry = (): SfAutocompleteRegistry => {
        cachedRegistry ??= validateRegistry(JSON.parse(fs.readFileSync(
            path.join(context.extensionPath, 'data', 'sf-autocomplete.json'),
            'utf8',
        )));
        return cachedRegistry;
    };

    const provider = vscode.languages.registerCompletionItemProvider(
        [
            'css',
            'scss',
            'sass',
            'less',
            'html',
            'javascript',
            'javascriptreact',
            'typescript',
            'typescriptreact',
            'vue',
            'react',
        ],
        {
            provideCompletionItems(document, position) {
                const line = document.lineAt(position).text;
                const request = detectCompletionRequest(
                    line,
                    position.character,
                    document.languageId,
                );
                if (!request) return undefined;

                const registry = loadRegistry();
                const entries = matchingEntries(registry.entries, request);
                if (entries.length === 0) return undefined;

                return entries.map(entry => {
                    const label = completionLabel(entry, request);
                    const item = new vscode.CompletionItem(
                        label,
                        request.context === 'htmlClass'
                            ? vscode.CompletionItemKind.Value
                            : vscode.CompletionItemKind.Variable,
                    );
                    item.detail = [
                        entry.description,
                        `mobile ${entry.modes.mobile.px}px`,
                        `desktop ${entry.modes.desktop.px}px`,
                        registry.source.contractVersion,
                    ].join(' · ');
                    item.documentation = new vscode.MarkdownString(
                        `Source contract: \`${registry.source.sha256}\``,
                    );
                    item.range = new vscode.Range(
                        position.translate(0, -request.replaceLength),
                        position,
                    );
                    return item;
                });
            },
        },
        '-',
        '.',
        '/',
        ':',
    );

    context.subscriptions.push(provider);
}

export function deactivate(): void {}

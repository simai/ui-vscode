import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    completionLabel,
    detectCompletionRequest,
    matchingEntries,
} from './completion';
import { validateRegistry } from './registry/validation';

export function activate(context: vscode.ExtensionContext): void {
    const registryPath = path.join(
        context.extensionPath,
        'src',
        'registry',
        'sf-autocomplete.json',
    );
    const registry = validateRegistry(
        JSON.parse(fs.readFileSync(registryPath, 'utf8')),
    );

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

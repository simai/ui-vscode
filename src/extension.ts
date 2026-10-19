import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    CompletionRequest,
    completionLabel,
    detectCompletionRequest,
    matchingEntries,
} from './completion';
import {
    FrameworkIndex,
    createIndex,
    describeAttribute,
    describeClass,
    describeTag,
    describeToken,
    escapeClass,
    nearestColorTokens,
    tokenDetail,
} from './framework';
import { MarkupRequest, detectMarkupRequest } from './markup';
import { formatColor } from './registry/color';
import { validateFrameworkRegistry } from './registry/frameworkValidation';
import { FrameworkToken, Rgba } from './registry/frameworkTypes';
import { validateRegistry } from './registry/validation';
import { findHoverTarget } from './targets';

const languages = [
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
];
/** Languages where `<` starts a tag even without a following letter. */
const markupLanguages = new Set(['html', 'vue', 'javascriptreact', 'typescriptreact', 'react']);
const stylesheetLanguages = new Set(['css', 'scss', 'sass', 'less']);
/** How far back to look for the start of a tag that spans lines. */
const markupLookbehindLines = 20;

const settings = (): vscode.WorkspaceConfiguration => vscode.workspace.getConfiguration('sf');

function textAbove(document: vscode.TextDocument, line: number): string {
    const start = Math.max(0, line - markupLookbehindLines);
    return document.getText(new vscode.Range(start, 0, line, 0));
}

const toColor = ([red, green, blue, alpha]: Rgba): vscode.Color =>
    new vscode.Color(red, green, blue, alpha);

const markdown = (value: string): vscode.MarkdownString => {
    const result = new vscode.MarkdownString(value);
    result.supportHtml = false;
    return result;
};

function tokenItem(
    index: FrameworkIndex,
    token: FrameworkToken,
    range: vscode.Range,
): vscode.CompletionItem {
    const item = new vscode.CompletionItem(
        token.name,
        token.color ? vscode.CompletionItemKind.Color : vscode.CompletionItemKind.Variable,
    );
    item.range = range;
    item.detail = tokenDetail(token);
    // The suggest widget draws a swatch only when the documentation is a
    // plain colour string; the full description is in the hover.
    item.documentation = token.color
        ? formatColor(token.color)
        : markdown(describeToken(index, token));
    return item;
}

function classItems(
    index: FrameworkIndex,
    request: CompletionRequest,
    range: vscode.Range,
): vscode.CompletionItem[] {
    const prefix = request.prefix.toLowerCase();
    const items: vscode.CompletionItem[] = [];
    for (const entry of index.framework.classes) {
        const label = request.escaped ? escapeClass(entry.name) : entry.name;
        if (!label.toLowerCase().startsWith(prefix)) continue;
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Constant);
        item.range = range;
        item.detail = entry.declarations;
        item.documentation = markdown(describeClass(index, entry));
        items.push(item);
    }
    return items;
}

function markupItems(
    index: FrameworkIndex,
    request: MarkupRequest,
    position: vscode.Position,
    languageId: string,
): vscode.CompletionItem[] {
    const range = new vscode.Range(position.translate(0, -request.prefix.length), position);
    if (request.kind === 'tag') {
        if (request.prefix === '' && !markupLanguages.has(languageId)) return [];
        return index.framework.tags
            .filter(tag => tag.tag.startsWith(request.prefix.toLowerCase()))
            .map(tag => {
                const item = new vscode.CompletionItem(tag.tag, vscode.CompletionItemKind.Class);
                item.range = range;
                item.detail = `SIMAI Framework · ${tag.title} · ${tag.lifecycle}`;
                item.documentation = markdown(describeTag(index, tag));
                if (tag.deprecated) item.tags = [vscode.CompletionItemTag.Deprecated];
                return item;
            });
    }

    const tag = index.tagByName.get(request.tag);
    if (!tag) return [];
    if (request.kind === 'attribute') {
        return tag.attributes
            .filter(attribute => !request.present.includes(attribute.name))
            .filter(attribute => attribute.name.startsWith(request.prefix))
            .map(attribute => {
                const item = new vscode.CompletionItem(
                    attribute.name,
                    vscode.CompletionItemKind.Property,
                );
                item.range = range;
                item.detail = attribute.deprecated
                    ? `deprecated${attribute.deprecated.replacement ? ` → ${attribute.deprecated.replacement}` : ''}`
                    : attribute.type;
                item.documentation = markdown(describeAttribute(tag, attribute));
                // Deprecated attributes sort after the current ones.
                item.sortText = `${attribute.deprecated ? '1' : '0'}${attribute.name}`;
                if (attribute.deprecated) item.tags = [vscode.CompletionItemTag.Deprecated];
                if (attribute.type !== 'boolean') {
                    item.insertText = new vscode.SnippetString(`${attribute.name}="$1"`);
                    if (attribute.values.length > 0 || attribute.examples.length > 0) {
                        item.command = {
                            title: 'Suggest values',
                            command: 'editor.action.triggerSuggest',
                        };
                    }
                }
                return item;
            });
    }

    const attribute = tag.attributes.find(item => item.name === request.attribute);
    if (!attribute) return [];
    const values = [
        ...attribute.values.map(value => ({ value, example: false })),
        ...attribute.examples
            .filter(value => !attribute.values.includes(value))
            .map(value => ({ value, example: true })),
    ];
    return values
        .filter(({ value }) => value.startsWith(request.prefix))
        .map(({ value, example }, position) => {
            const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember);
            item.range = range;
            item.detail = example
                ? `example for ${attribute.name}`
                : `${attribute.name}${value === attribute.default ? ' · default' : ''}`;
            item.sortText = String(position).padStart(4, '0');
            if (attribute.deprecated) item.tags = [vscode.CompletionItemTag.Deprecated];
            return item;
        });
}

export function activate(context: vscode.ExtensionContext): void {
    // Activation runs at startup (onStartupFinished) so that the very first
    // completion request already reaches these providers. Keep it cheap: the
    // registries are read on first use, not during activation.
    let cachedIndex: FrameworkIndex | undefined;
    const loadIndex = (): FrameworkIndex => {
        if (!cachedIndex) {
            const read = (file: string): unknown => JSON.parse(fs.readFileSync(
                path.join(context.extensionPath, 'data', file),
                'utf8',
            ));
            cachedIndex = createIndex(
                validateFrameworkRegistry(read('sf-framework.json')),
                validateRegistry(read('sf-autocomplete.json')),
            );
        }
        return cachedIndex;
    };

    const completion = vscode.languages.registerCompletionItemProvider(
        languages,
        {
            provideCompletionItems(document, position) {
                const line = document.lineAt(position).text;
                const request = detectCompletionRequest(
                    line,
                    position.character,
                    document.languageId,
                );
                if (request) {
                    const index = loadIndex();
                    const range = new vscode.Range(
                        position.translate(0, -request.replaceLength),
                        position,
                    );
                    if (request.context === 'cssVariable') {
                        const prefix = request.prefix.toLowerCase();
                        return index.tokens
                            .filter(token => token.name.toLowerCase().startsWith(prefix))
                            .map(token => tokenItem(index, token, range));
                    }
                    const items = classItems(index, request, range);
                    // Class aliases from the sizing contract, if it ever ships any.
                    const known = new Set(items.map(item => item.label));
                    for (const entry of matchingEntries(index.sizing.entries, request)) {
                        const label = completionLabel(entry, request);
                        if (known.has(label)) continue;
                        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Value);
                        item.range = range;
                        item.detail = entry.description;
                        items.push(item);
                    }
                    return items;
                }

                if (stylesheetLanguages.has(document.languageId)) return undefined;
                const markup = detectMarkupRequest(
                    textAbove(document, position.line) + line.slice(0, position.character),
                );
                if (!markup) return undefined;
                const items = markupItems(loadIndex(), markup, position, document.languageId);
                return items.length > 0 ? items : undefined;
            },
        },
        '-',
        '.',
        '/',
        ':',
        '<',
        ' ',
        '"',
        "'",
    );

    const hover = vscode.languages.registerHoverProvider(languages, {
        provideHover(document, position) {
            if (!settings().get<boolean>('hover.enabled', true)) return undefined;
            const line = document.lineAt(position).text;
            const target = findHoverTarget(
                line,
                position.character,
                document.languageId,
                textAbove(document, position.line),
            );
            if (!target) return undefined;
            const index = loadIndex();
            let text: string | undefined;
            if (target.kind === 'token') {
                const token = index.tokenByName.get(target.name);
                if (token) text = describeToken(index, token);
            } else if (target.kind === 'class') {
                const item = index.classByName.get(target.name);
                if (item) text = describeClass(index, item);
            } else if (target.kind === 'tag') {
                const tag = index.tagByName.get(target.name);
                if (tag) text = describeTag(index, tag);
            } else {
                const tag = index.tagByName.get(target.tag);
                const attribute = tag?.attributes.find(item => item.name === target.name);
                if (tag && attribute) text = describeAttribute(tag, attribute);
            }
            if (!text) return undefined;
            return new vscode.Hover(
                markdown(text),
                new vscode.Range(position.line, target.start, position.line, target.end),
            );
        },
    });

    const colors = vscode.languages.registerColorProvider(languages, {
        provideDocumentColors(document) {
            if (!settings().get<boolean>('colorSwatches.enabled', true)) return [];
            const text = document.getText();
            if (!text.includes('--sf-')) return [];
            const index = loadIndex();
            const result: vscode.ColorInformation[] = [];
            for (const match of text.matchAll(/--sf-(?:\\.|[A-Za-z0-9_-])+/g)) {
                const token = index.tokenByName.get(match[0]);
                if (!token?.color) continue;
                const start = document.positionAt(match.index!);
                const end = document.positionAt(match.index! + match[0].length);
                result.push(new vscode.ColorInformation(
                    new vscode.Range(start, end),
                    toColor(token.color),
                ));
            }
            return result;
        },
        provideColorPresentations(color, { range }) {
            // Picking a colour offers the nearest SIMAI Framework colour tokens.
            const index = loadIndex();
            return nearestColorTokens(
                index,
                [color.red, color.green, color.blue, color.alpha],
                8,
            ).map(token => {
                const presentation = new vscode.ColorPresentation(token.name);
                presentation.textEdit = new vscode.TextEdit(range, token.name);
                return presentation;
            });
        },
    });

    context.subscriptions.push(completion, hover, colors);
}

export function deactivate(): void {}

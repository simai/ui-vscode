import * as assert from 'assert';
import * as vscode from 'vscode';

async function completionsAt(
    language: string,
    content: string,
): Promise<vscode.CompletionItem[]> {
    const document = await vscode.workspace.openTextDocument({ language, content });
    const lines = content.split('\n');
    const position = new vscode.Position(
        lines.length - 1,
        lines[lines.length - 1].length,
    );
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        document.uri,
        position,
    );
    return list.items;
}

const labelOf = (item: vscode.CompletionItem): string =>
    typeof item.label === 'string' ? item.label : item.label.label;

suite('sizing completions', () => {
    test('the first request after activation already returns SF variables', async () => {
        const items = await completionsAt('css', '.a { margin: var(--sf-sp');
        const names = items.map(labelOf).filter(label => label.startsWith('--sf-space-'));
        assert.ok(names.length >= 12, `expected spacing variables, got ${names.length}`);
    });
});

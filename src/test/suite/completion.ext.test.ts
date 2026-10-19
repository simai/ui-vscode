import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const extensions: Record<string, string> = {
    css: 'css',
    scss: 'scss',
    html: 'html',
    vue: 'vue',
    typescript: 'ts',
    typescriptreact: 'tsx',
};
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-docs-'));
let fixtureCount = 0;

/**
 * Writes a real file and opens it, so the language comes from the file
 * extension as in a user's workspace. `|` marks the cursor.
 */
async function open(language: string, marked: string): Promise<{
    document: vscode.TextDocument;
    position: vscode.Position;
}> {
    const offset = marked.indexOf('|');
    assert.ok(offset >= 0, 'fixture needs a cursor mark');
    fixtureCount += 1;
    const file = path.join(fixtureRoot, `doc${fixtureCount}.${extensions[language]}`);
    fs.writeFileSync(file, marked.slice(0, offset) + marked.slice(offset + 1));
    const document = await vscode.workspace.openTextDocument(file);
    if (document.languageId !== language) {
        await vscode.languages.setTextDocumentLanguage(document, language);
    }
    return { document, position: document.positionAt(offset) };
}

suiteTeardown(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

async function completions(language: string, marked: string): Promise<vscode.CompletionItem[]> {
    const { document, position } = await open(language, marked);
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        document.uri,
        position,
    );
    return list.items;
}

async function hoverText(language: string, marked: string): Promise<string> {
    const { document, position } = await open(language, marked);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        document.uri,
        position,
    );
    return hovers
        .flatMap(hover => hover.contents)
        .map(content => (typeof content === 'string' ? content : content.value))
        .join('\n');
}

const labelOf = (item: vscode.CompletionItem): string =>
    typeof item.label === 'string' ? item.label : item.label.label;
const find = (items: vscode.CompletionItem[], label: string): vscode.CompletionItem | undefined =>
    items.find(item => labelOf(item) === label);

suite('completion provider', () => {
    test('the first request after activation already returns SF variables', async () => {
        const items = await completions('css', '.a { margin: var(--sf-sp|');
        const names = items.map(labelOf).filter(label => label.startsWith('--sf-space-'));
        assert.ok(names.length >= 12, `expected spacing variables, got ${names.length}`);
        const space = find(items, '--sf-space-1')!;
        assert.equal(space.detail, 'mobile 12px · desktop 16px');
        assert.deepEqual(
            [space.range instanceof vscode.Range ? space.range.start.character : -1],
            ['.a { margin: var('.length],
        );
    });

    test('colour tokens carry a swatch colour', async () => {
        const items = await completions('scss', '.a { color: var(--sf-primary|');
        const primary = find(items, '--sf-primary')!;
        assert.equal(primary.kind, vscode.CompletionItemKind.Color);
        assert.equal(primary.documentation, '#005bbe');
        assert.equal(primary.detail, 'light #005bbe · dark #acc7ff');
    });

    test('fractional roles keep their escaped slash', async () => {
        const items = await completions('css', '.a { border-radius: var(--sf-radius-1\\/|');
        assert.ok(find(items, '--sf-radius-1\\/2'));
    });

    test('public component variables are suggested', async () => {
        const items = await completions('css', '.x { --sf-button-ra|');
        assert.ok(find(items, '--sf-button-radius'));
    });

    test('utility classes complete in class attributes with literal names', async () => {
        const items = await completions('html', '<div class="flex md:fl|');
        const item = find(items, 'md:flex')!;
        assert.ok(item, 'md:flex missing');
        assert.equal(item.detail, 'display: flex;');
        const range = item.range as vscode.Range;
        assert.equal(range.start.character, '<div class="flex '.length);
    });

    test('utility classes complete in JSX className', async () => {
        const items = await completions('typescriptreact', 'const a = <div className="fl|');
        assert.ok(find(items, 'flex'));
    });

    test('utility classes complete as escaped selectors in CSS', async () => {
        const items = await completions('css', '.md\\:fl|');
        assert.ok(find(items, 'md\\:flex'));
    });

    test('sf- tags complete in HTML, and in Vue when a Vue extension is present', async () => {
        const known = await vscode.languages.getLanguages();
        for (const language of ['html', 'vue'].filter(id => known.includes(id))) {
            const items = await completions(language, '<div><sf-bu|');
            const button = find(items, 'sf-button');
            assert.ok(button, `sf-button missing in ${language}`);
            assert.match(String(button.detail), /experimental/);
        }
    });

    test('attributes complete without the ones already present', async () => {
        const items = await completions('html', '<sf-button size="1" |');
        assert.ok(find(items, 'appearance'));
        assert.ok(find(items, 'loading'));
        assert.equal(find(items, 'size'), undefined);
    });

    test('deprecated attributes are tagged and named with their replacement', async () => {
        const items = await completions('html', '<sf-context-menu pos|');
        const position = find(items, 'position')!;
        assert.deepEqual(position.tags, [vscode.CompletionItemTag.Deprecated]);
        assert.match(String(position.detail), /^deprecated → openFor/);
    });

    test('attribute values come from the manifest', async () => {
        const items = await completions('html', '<sf-button\n  appearance="|');
        assert.deepEqual(
            items.filter(item => item.kind === vscode.CompletionItemKind.EnumMember).map(labelOf),
            ['default', 'tonal', 'outline', 'link', 'surface', 'ghost'],
        );
    });

    test('a dot in prose or code does not suggest classes', async () => {
        // VS Code adds word-based suggestions (kind Text); look at ours only.
        const classes = (items: vscode.CompletionItem[]): vscode.CompletionItem[] =>
            items.filter(item => item.kind === vscode.CompletionItemKind.Constant);
        assert.deepEqual(classes(await completions('html', '<p>The end.|')), []);
        assert.deepEqual(classes(await completions('typescript', 'document.b|')), []);
    });
});

suite('hover provider', () => {
    test('tokens show light and dark values and the release', async () => {
        const text = await hoverText('css', '.a { color: var(--sf-pri|mary); }');
        assert.match(text, /--sf-primary/);
        assert.match(text, /\| light \| #005bbe \|/);
        assert.match(text, /\| dark \| #acc7ff \|/);
        assert.match(text, /ui-a9636b60d3e3/);
    });

    test('sizing tokens show mobile and desktop values', async () => {
        const text = await hoverText('css', '.a { gap: var(--sf-spa|ce-1); }');
        assert.match(text, /\| mobile \| 12px \(0\.75rem\) \|/);
        assert.match(text, /desktop .*16px \(1rem\)/);
    });

    test('classes show their rule and lifecycle', async () => {
        const text = await hoverText('html', '<div class="md:fl|ex">');
        assert.match(text, /@media \(min-width: 44rem\) \{ \.md\\:flex \{ display: flex; \} \}/);
        assert.match(text, /utility\.display` · released/);
    });

    test('tags show the summary, lifecycle and documentation', async () => {
        const text = await hoverText('html', '<sf-but|ton></sf-button>');
        assert.match(text, /Buttons/);
        assert.match(text, /smart\.buttons` · experimental/);
        assert.match(text, /\[Documentation\]\(https:\/\/github\.com\/simai\/ui\/blob\//);
    });

    test('attributes show values and deprecation', async () => {
        const text = await hoverText('html', '<sf-context-menu posi|tion="top">');
        assert.match(text, /\*\*Deprecated\*\* since 1\.3\.0/);
    });
});

suite('colour provider', () => {
    test('colour tokens get swatches and nearest-token presentations', async () => {
        const { document } = await open('css', '|.a { color: var(--sf-primary); background: var(--sf-space-1); }');
        const colors = await vscode.commands.executeCommand<vscode.ColorInformation[]>(
            'vscode.executeDocumentColorProvider',
            document.uri,
        );
        const ours = colors.filter(info => document.getText(info.range).startsWith('--sf-'));
        assert.equal(ours.length, 1);
        assert.equal(document.getText(ours[0].range), '--sf-primary');
        assert.equal(Math.round(ours[0].color.blue * 255), 0xbe);

        const presentations = await vscode.commands.executeCommand<vscode.ColorPresentation[]>(
            'vscode.executeColorPresentationProvider',
            ours[0].color,
            { uri: document.uri, range: ours[0].range },
        );
        assert.ok(presentations.some(item => item.label === '--sf-primary'));
    });
});

/*
 * Takes the Marketplace screenshots from a running VS Code with the extension
 * loaded. VS Code is started with --remote-debugging-port (see
 * runScreenshots.ts); each scene opens a real file, shows the feature and
 * captures the workbench window with the Chrome DevTools Protocol, so no OS
 * screen-recording permission is needed.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const port = Number(process.env.SF_DEBUG_PORT ?? 9333);
const outputDir = process.env.SF_SCREENSHOT_DIR ?? path.resolve(__dirname, '..', '..', '..', 'images');
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function capture(name: string): Promise<void> {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as {
        type: string;
        url: string;
        webSocketDebuggerUrl: string;
    }[];
    const page = targets.find(target => target.type === 'page' && target.url.includes('workbench'));
    if (!page) throw new Error('workbench page not found');
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
    });
    const data = await new Promise<string>((resolve, reject) => {
        socket.onmessage = event => {
            const message = JSON.parse(String(event.data)) as { id: number; result?: { data: string }; error?: unknown };
            if (message.id !== 1) return;
            if (message.result) resolve(message.result.data);
            else reject(new Error(JSON.stringify(message.error)));
        };
        socket.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
    });
    socket.close();
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(data, 'base64'));
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-shots-'));

/** Opens `content` in an editor with the cursor at `|`. */
async function show(file: string, marked: string): Promise<vscode.TextEditor> {
    const offset = marked.indexOf('|');
    const target = path.join(root, file);
    fs.writeFileSync(target, marked.replace('|', ''));
    const document = await vscode.workspace.openTextDocument(target);
    const editor = await vscode.window.showTextDocument(document);
    const position = document.positionAt(offset);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    await sleep(800);
    return editor;
}

async function scene(name: string, file: string, marked: string, command: string, wait = 1500): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await show(file, marked);
    await vscode.commands.executeCommand('notifications.clearAll');
    await vscode.commands.executeCommand(command);
    await sleep(wait);
    await capture(name);
    await vscode.commands.executeCommand('hideSuggestWidget');
    await vscode.commands.executeCommand('editor.action.hideHover');
}

export async function run(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.closeSidebar');
    await vscode.commands.executeCommand('workbench.action.closePanel');
    await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    await sleep(1500);

    await scene(
        'screenshot-tags',
        'form.html',
        '<form class="flex flex-col g-1">\n  <sf-input label="Email" name="email" input-type="email"></sf-input>\n  <sf-|\n</form>\n',
        'editor.action.triggerSuggest',
    );
    await scene(
        'screenshot-attributes',
        'button.html',
        '<sf-button\n  text="Save"\n  appearance="|"\n></sf-button>\n',
        'editor.action.triggerSuggest',
    );
    await scene(
        'screenshot-classes',
        'Toolbar.tsx',
        'export function Toolbar() {\n  return (\n    <div className="flex g-1/2 md:fl|">\n      <sf-button text="Save"></sf-button>\n    </div>\n  );\n}\n',
        'editor.action.triggerSuggest',
    );
    await scene(
        'screenshot-colors',
        'theme.css',
        '.card {\n  color: var(--sf-on-surface);\n  background: var(--sf-surface-container);\n  border-color: var(--sf-outline-variant);\n  accent-color: var(--sf-pri|);\n}\n',
        'editor.action.triggerSuggest',
    );
    await scene(
        'screenshot-hover',
        'layout.css',
        '.section {\n  padding-block: var(--sf-spa|ce-4);\n  gap: var(--sf-space-2);\n}\n',
        'editor.action.showHover',
    );
    await scene(
        'screenshot-diagnostics',
        'menu.html',
        '<sf-context-menu position="top"></sf-context-menu>\n<sf-button appe|rance="tonal" text="Save"></sf-button>\n<style>\n  .x { color: var(--sf-primay); }\n</style>\n',
        'editor.action.showHover',
        2500,
    );
    fs.rmSync(root, { recursive: true, force: true });
}

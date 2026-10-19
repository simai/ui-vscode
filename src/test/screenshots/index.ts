/*
 * Takes the Marketplace screenshots from a running VS Code with the extension
 * loaded. VS Code is started with --remote-debugging-port (see
 * runScreenshots.ts); each scene opens a real file, shows the feature and
 * captures the workbench with the Chrome DevTools Protocol, so no OS
 * screen-recording permission is needed.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const port = Number(process.env.SF_DEBUG_PORT ?? 9333);
const outputDir = process.env.SF_SCREENSHOT_DIR ?? path.resolve(__dirname, '..', '..', '..', 'images');
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Measures the strip worth capturing: the workbench down to the widget the
 * scene is about, so a Marketplace screenshot is a wide, short band and not a
 * window mostly full of empty editor. `shown` is false while the widget is
 * still opening, which is what the capture waits for.
 */
const bandScript = (widget: Widget): string => `(() => {
    const box = [...document.querySelectorAll('${widget.selector}')]
        .map(node => node.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0)
        .sort((left, right) => right.bottom - left.bottom)[0];
    const editor = document.querySelector('.monaco-editor');
    const floor = editor ? editor.getBoundingClientRect().top + 150 : 300;
    return {
        shown: Boolean(box),
        width: window.innerWidth,
        height: Math.min(window.innerHeight, Math.ceil(Math.max(floor, box ? box.bottom : 0)) + 12),
    };
})()`;

/** Captured at 2x so the images stay crisp wherever they were taken. */
const captureScale = 2;

interface Widget {
    selector: string;
}

interface Band {
    shown: boolean;
    width: number;
    height: number;
}

type Call = <T>(method: string, params: unknown) => Promise<T>;

async function measure(call: Call, widget: Widget): Promise<Band> {
    const evaluated = await call<{ result: { value?: Band }; exceptionDetails?: unknown }>(
        'Runtime.evaluate',
        { expression: bandScript(widget), returnByValue: true },
    );
    if (evaluated.exceptionDetails || !evaluated.result.value) {
        throw new Error(`measuring ${widget.selector}: ${JSON.stringify(evaluated.exceptionDetails)}`);
    }
    return evaluated.result.value;
}

async function capture(name: string, widget: Widget, settle: number): Promise<void> {
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
    let lastId = 0;
    const call = <T>(method: string, params: unknown): Promise<T> => {
        const id = (lastId += 1);
        return new Promise<T>((resolve, reject) => {
            const onMessage = (event: MessageEvent): void => {
                const message = JSON.parse(String(event.data)) as {
                    id: number;
                    result?: T;
                    error?: unknown;
                };
                if (message.id !== id) return;
                socket.removeEventListener('message', onMessage);
                if (message.result) resolve(message.result);
                else reject(new Error(`${method}: ${JSON.stringify(message.error)}`));
            };
            socket.addEventListener('message', onMessage);
            socket.send(JSON.stringify({ id, method, params }));
        });
    };
    try {
        // The widget opens asynchronously. Waiting for it beats a fixed sleep,
        // which used to leave a scene without the feature it is meant to show.
        let band: Band | undefined;
        for (let attempt = 0; attempt < 40 && !band?.shown; attempt += 1) {
            if (attempt > 0) await sleep(250);
            band = await measure(call, widget);
        }
        if (!band?.shown) throw new Error(`${name}: ${widget.selector} never appeared`);
        // Let the widget finish fading in and the editor finish marking the
        // document, then measure again: a half-drawn widget ghosts the code
        // underneath it.
        await sleep(settle);
        band = await measure(call, widget);
        const shot = await call<{ data: string }>('Page.captureScreenshot', {
            format: 'png',
            clip: { x: 0, y: 0, width: band.width, height: band.height, scale: captureScale },
        });
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
    } finally {
        socket.close();
    }
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

// A suggest widget keeps its box while it is hidden and while it still shows
// "Loading…", so measure the rows it ended up with instead of the box itself.
const widgets: Record<string, Widget> = {
    'editor.action.triggerSuggest': { selector: '.suggest-widget .monaco-list-row' },
    'editor.action.showHover': { selector: '.monaco-hover' },
};

type Command = 'editor.action.triggerSuggest' | 'editor.action.showHover';

async function scene(
    name: string,
    file: string,
    marked: string,
    command: Command,
    settle = 600,
): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await show(file, marked);
    await vscode.commands.executeCommand('notifications.clearAll');
    await vscode.commands.executeCommand(command);
    await capture(name, widgets[command], settle);
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
        // The scene is about the squiggles too, so give every analysed name
        // time to be marked before the capture.
        1500,
    );
    fs.rmSync(root, { recursive: true, force: true });
}

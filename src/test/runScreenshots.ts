/*
 * Starts VS Code with the extension and a DevTools port and runs the
 * screenshot scenes in src/test/screenshots. Set SF_EXTENSION_PATH to use the
 * copy installed from the packaged .vsix.
 */
import * as fs from 'fs';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    const userDataDir = fs.mkdtempSync('/tmp/sfs.');
    fs.mkdirSync(path.join(userDataDir, 'User'), { recursive: true });
    fs.writeFileSync(path.join(userDataDir, 'User', 'settings.json'), JSON.stringify({
        'workbench.colorTheme': 'Default Dark Modern',
        'workbench.startupEditor': 'none',
        'workbench.activityBar.location': 'hidden',
        'workbench.statusBar.visible': false,
        'workbench.layoutControl.enabled': false,
        'window.commandCenter': false,
        'breadcrumbs.enabled': false,
        'editor.minimap.enabled': false,
        'editor.fontSize': 15,
        'editor.lineHeight': 24,
        'editor.suggest.showStatusBar': false,
        'editor.suggestSelection': 'first',
        'editor.hover.delay': 100,
        'chat.commandCenter.enabled': false,
        'chat.disableAIFeatures': true,
        'telemetry.telemetryLevel': 'off',
    }, null, 2));
    try {
        await runTests({
            extensionDevelopmentPath: process.env.SF_EXTENSION_PATH
                ? path.resolve(process.env.SF_EXTENSION_PATH)
                : path.resolve(__dirname, '..', '..'),
            extensionTestsPath: path.resolve(__dirname, 'screenshots', 'index'),
            vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH || undefined,
            launchArgs: [
                '--disable-extensions',
                '--disable-workspace-trust',
                '--skip-welcome',
                '--skip-release-notes',
                `--remote-debugging-port=${process.env.SF_DEBUG_PORT ?? 9333}`,
                `--user-data-dir=${userDataDir}`,
            ],
        });
    } finally {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});

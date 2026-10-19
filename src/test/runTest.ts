import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    // SF_EXTENSION_PATH runs the suite against another copy of the
    // extension, for example the one installed from the packaged .vsix.
    const extensionDevelopmentPath = process.env.SF_EXTENSION_PATH
        ? path.resolve(process.env.SF_EXTENSION_PATH)
        : path.resolve(__dirname, '..', '..');
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index');
    // VS Code refuses a user data directory whose IPC socket path would
    // exceed the 103-character Unix socket limit, so keep it short.
    const shortRoot = os.platform() === 'win32' ? os.tmpdir() : '/tmp';
    const userDataDir = fs.mkdtempSync(path.join(shortRoot, 'sfx.'));
    try {
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH || undefined,
            version: process.env.VSCODE_TEST_VERSION || undefined,
            launchArgs: [
                '--disable-extensions',
                '--disable-workspace-trust',
                '--skip-welcome',
                '--skip-release-notes',
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

import * as path from 'path';
import Mocha from 'mocha';
import { globSync } from 'glob';

export function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 20000 });
    const testsRoot = __dirname;
    for (const file of globSync('**/*.ext.test.js', { cwd: testsRoot })) {
        mocha.addFile(path.join(testsRoot, file));
    }
    return new Promise((resolve, reject) => {
        mocha.run(failures => {
            if (failures > 0) {
                reject(new Error(`${failures} extension tests failed.`));
            } else {
                resolve();
            }
        });
    });
}

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export async function moveToTrash(filePath, { execFileFn = execFileAsync, platform = process.platform } = {}) {
    const resolved = path.resolve(filePath);
    if (platform === 'win32') {
        const script = [
            'Add-Type -AssemblyName Microsoft.VisualBasic',
            `$p = ${JSON.stringify(resolved)}`,
            'if (-not (Test-Path -LiteralPath $p)) { throw "path not found" }',
            "[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p, 'OnlyErrorDialogs', 'SendToRecycleBin')",
        ].join('; ');
        await execFileFn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
        return;
    }
    if (platform === 'darwin') {
        await execFileFn('osascript', [
            '-e',
            `tell application "Finder" to delete POSIX file ${JSON.stringify(resolved)}`,
        ]);
        return;
    }
    try {
        await execFileFn('gio', ['trash', resolved]);
    } catch {
        await execFileFn('trash-put', [resolved]);
    }
}

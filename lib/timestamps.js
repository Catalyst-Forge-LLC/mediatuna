import fs from 'fs';
import { execFileSync } from 'child_process';

export const CREATED_REPAIR_DAYS = 30;

export function readFileTimes(filePath) {
    const stats = fs.statSync(filePath);
    return {
        atime: stats.atime,
        mtime: stats.mtime,
        birthtime: stats.birthtime,
        ctime: stats.ctime,
    };
}

export function createdIsMovedCopy(times, { days = CREATED_REPAIR_DAYS } = {}) {
    const created = times.birthtime?.getTime?.() || times.ctime.getTime();
    const modified = times.mtime.getTime();
    return created - modified > days * 24 * 60 * 60 * 1000;
}

export function applyFileTimes(filePath, times) {
    fs.utimesSync(filePath, times.atime, times.mtime);
    if (process.platform === 'win32' && times.birthtime) {
        execFileSync('powershell', [
            '-NoProfile', '-Command',
            `$p = ${JSON.stringify(filePath)}; $c = [datetime]${JSON.stringify(times.birthtime.toISOString())}; `
            + '$f = Get-Item -LiteralPath $p; $f.CreationTime = $c; $f.LastWriteTime = [datetime]'
            + JSON.stringify(times.mtime.toISOString()),
        ], { stdio: 'ignore' });
    }
}

export function repairCreatedIfMoved(filePath, { days = CREATED_REPAIR_DAYS } = {}) {
    const times = readFileTimes(filePath);
    if (!createdIsMovedCopy(times, { days })) return false;
    const fixed = { ...times, birthtime: times.mtime, ctime: times.mtime };
    applyFileTimes(filePath, fixed);
    return true;
}

export function copyAndRepairTimestamps(input, output, { repairCreated = true } = {}) {
    const times = readFileTimes(input);
    applyFileTimes(output, times);
    if (repairCreated) repairCreatedIfMoved(output);
}

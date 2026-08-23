import fs from 'fs';
import path from 'path';
import { uniqueDestPath } from './paths.js';

export function archiveDestPath(input, archiveDir, { rootDir = null } = {}) {
    const abs = path.resolve(input);
    const root = rootDir ? path.resolve(rootDir) : path.dirname(abs);
    const rel = path.relative(root, abs);
    const safeRel = !rel || rel.startsWith('..') || path.isAbsolute(rel) ? path.basename(abs) : rel;
    return path.join(path.resolve(archiveDir), safeRel);
}

export function formatArchivePlanLines(candidates, { archiveDir, dryRun = false } = {}) {
    const prefix = dryRun ? '[DRY] ' : '';
    const lines = ['', `${prefix}Sources below will be moved to ${archiveDir} after a verified convert (or cleanup).`, ''];
    const showMax = 25;
    for (const [i, entry] of candidates.entries()) {
        if (i >= showMax) {
            lines.push(`  ... and ${candidates.length - showMax} more`);
            break;
        }
        lines.push(`  ${entry.input}`);
        lines.push(`    → ${entry.dest}`);
    }
    lines.push('');
    lines.push(`${prefix}${candidates.length} file(s) ready to archive.`);
    lines.push('');
    return lines;
}

export function moveOriginalsToArchive(paths, archiveDir, {
    rootDir = null,
    logConsole = () => {},
    existsFn = fs.existsSync,
    mkdirFn = fs.mkdirSync,
    renameFn = fs.renameSync,
    copyFn = fs.copyFileSync,
    unlinkFn = fs.unlinkSync,
    statFn = fs.statSync,
} = {}) {
    let moved = 0;
    let failed = 0;
    for (const filePath of paths) {
        try {
            if (!existsFn(filePath)) continue;
            const destBase = archiveDestPath(filePath, archiveDir, { rootDir });
            mkdirFn(path.dirname(destBase), { recursive: true });
            const dest = uniqueDestPath(destBase, existsFn);
            try {
                renameFn(filePath, dest);
            } catch (err) {
                if (err.code !== 'EXDEV') throw err;
                copyFn(filePath, dest);
                const stat = statFn(filePath);
                fs.utimesSync(dest, stat.atime, stat.mtime);
                unlinkFn(filePath);
            }
            logConsole(`Archived original: ${filePath} → ${dest}`);
            moved++;
        } catch (err) {
            logConsole(`Error archiving ${filePath}: ${err.message}`);
            failed++;
        }
    }
    return { moved, failed };
}

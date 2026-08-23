import fs from 'fs';
import path from 'path';
import { moveToTrash } from './trash.js';

export function formatDeletionPlanLines(candidates, { intro, countLabel, dryRun = false }) {
    const prefix = dryRun ? '[DRY] ' : '';
    const lines = ['', `${prefix}${intro}`, ''];
    const showMax = 25;
    for (const [i, entry] of candidates.entries()) {
        if (i >= showMax) {
            lines.push(`  ... and ${candidates.length - showMax} more`);
            break;
        }
        lines.push(`  ${entry.input}`);
        lines.push(`    → ${entry.out}`);
    }
    lines.push('');
    lines.push(`${prefix}${candidates.length} file(s) ${countLabel}.`);
    lines.push('');
    return lines;
}

export function buildCleanupCandidates(preflight, verifyOutputFn) {
    const eligible = [];
    const skipped = [];

    for (const entry of preflight) {
        if (entry.status !== 'skip (exists)') {
            if (entry.status.startsWith('convert')) {
                skipped.push({ entry, reason: 'output does not exist yet' });
            }
            continue;
        }

        if (path.resolve(entry.input) === path.resolve(entry.out)) {
            skipped.push({ entry, reason: 'already the converted output' });
            continue;
        }

        const expectedType = entry.meta.mediaType === 'audio' ? 'audio' : 'video';
        const check = verifyOutputFn(entry.out, entry.meta.duration, expectedType);
        if (check.ok) {
            eligible.push(entry);
        } else {
            skipped.push({ entry, reason: check.reason });
        }
    }

    return { eligible, skipped };
}

export async function deleteOriginalFiles(paths, logConsole, {
    permanent = false,
    trashFn = moveToTrash,
    unlinkFn = (filePath) => fs.unlinkSync(filePath),
    existsFn = fs.existsSync,
} = {}) {
    let deleted = 0;
    let deleteFailed = 0;
    for (const filePath of paths) {
        try {
            if (!existsFn(filePath)) continue;
            if (permanent) {
                unlinkFn(filePath);
                logConsole(`Deleted original (permanent): ${filePath}`);
            } else {
                await trashFn(filePath);
                logConsole(`Moved original to Recycle Bin / trash: ${filePath}`);
            }
            deleted++;
        } catch (err) {
            logConsole(`Error deleting ${filePath}: ${err.message}`);
            deleteFailed++;
        }
    }
    return { deleted, deleteFailed };
}

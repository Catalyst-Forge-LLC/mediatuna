import fs from 'fs';
import path from 'path';

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

export function deleteOriginalFiles(paths, logConsole) {
    let deleted = 0;
    let deleteFailed = 0;
    for (const filePath of paths) {
        try {
            if (!fs.existsSync(filePath)) continue;
            fs.unlinkSync(filePath);
            logConsole(`Deleted original: ${filePath}`);
            deleted++;
        } catch (err) {
            logConsole(`Error deleting ${filePath}: ${err.message}`);
            deleteFailed++;
        }
    }
    return { deleted, deleteFailed };
}

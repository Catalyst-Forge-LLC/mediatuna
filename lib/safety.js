import fs from 'fs';
import path from 'path';
import { isConvertStatus } from './status.js';

export const LARGE_BATCH_THRESHOLD = 50;
export const STAMP_BACKUP_WARN_THRESHOLD = 10;
export const DISK_RESERVE_BYTES = 200 * 1024 * 1024;
export const VIDEO_OUTPUT_FACTOR = 1.2;
export const AUDIO_OUTPUT_FACTOR = 0.3;
export const EXTRACT_OUTPUT_FACTOR = 0.15;

export const LOSSY_BANNER = 'Outputs are lossy (H.264/AAC MP4 or LAME MP3). Keep sources until you have checked playback.';

export function formatWriteLocationBanner({ count, outputDir, sourceDir }) {
    if (outputDir) return `Writing ${count} output(s) under ${outputDir}.`;
    return `Writing ${count} file(s) beside sources in ${sourceDir}.`;
}

export function formatLargeBatchPrompt({ count, root, threshold = LARGE_BATCH_THRESHOLD }) {
    return `${count} files under ${root} (more than ${threshold}). Press Enter to continue, or Ctrl+C to stop: `;
}

export function formatStampBackupWarn(count, threshold = STAMP_BACKUP_WARN_THRESHOLD) {
    return `--stamp-dates will rename ${count} sources in place with no --backup (more than ${threshold}). Press Enter to continue, or Ctrl+C to stop: `;
}

export function formatForceOverwritePrompt(count) {
    return `--force will overwrite ${count} existing output(s). Continue? [y/N]: `;
}

export function shouldShowLossyBanner(entries) {
    return entries.some(entry =>
        isConvertStatus(entry.videoStatus) || (entry.extractStatus && isConvertStatus(entry.extractStatus)));
}

export function countOverwriteTargets(entries, { existsFn = fs.existsSync } = {}) {
    let count = 0;
    for (const entry of entries) {
        if (isConvertStatus(entry.videoStatus) && existsFn(entry.out)) count++;
        if (entry.extractStatus && isConvertStatus(entry.extractStatus) && entry.audioOut && existsFn(entry.audioOut)) {
            count++;
        }
    }
    return count;
}

export function estimateNeededBytes(entries) {
    let bytes = 0;
    for (const entry of entries) {
        const size = Number(entry.meta?.size) || 0;
        if (isConvertStatus(entry.videoStatus)) {
            bytes += entry.meta?.mediaType === 'audio'
                ? size * AUDIO_OUTPUT_FACTOR
                : size * VIDEO_OUTPUT_FACTOR;
        }
        if (entry.extractStatus && isConvertStatus(entry.extractStatus)) {
            bytes += size * EXTRACT_OUTPUT_FACTOR;
        }
    }
    return Math.ceil(bytes);
}

export function checkFreeSpace(destDir, neededBytes, {
    statfsFn = fs.statfsSync,
    reserveBytes = DISK_RESERVE_BYTES,
} = {}) {
    const resolved = path.resolve(destDir);
    const stats = statfsFn(resolved);
    const free = Number(stats.bavail) * Number(stats.bsize);
    const needed = neededBytes + reserveBytes;
    return {
        ok: free >= needed,
        free,
        needed,
        destDir: resolved,
    };
}

export function formatDiskSpaceError(check) {
    const gb = n => `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
    return `Not enough free space on ${check.destDir}: need about ${gb(check.needed)} (including reserve), ${gb(check.free)} available. Free disk space, use --output on another volume, or pass --yes to continue anyway.`;
}

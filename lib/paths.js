import fs from 'fs';
import path from 'path';
import { stampedOutputStem } from './stamp-dates.js';

export function uniqueDestPath(dest, existsFn = fs.existsSync) {
    if (!existsFn(dest)) return dest;
    const ext = path.extname(dest);
    const stem = dest.slice(0, dest.length - ext.length);
    for (let n = 2; n < 1000; n++) {
        const candidate = `${stem}-${n}${ext}`;
        if (!existsFn(candidate)) return candidate;
    }
    return `${stem}-${Date.now()}${ext}`;
}

export function outputDirFor(input, outputDir, { rootDir = null } = {}) {
    if (!outputDir) return path.dirname(input);
    if (!rootDir) return outputDir;
    const rel = path.relative(path.resolve(rootDir), path.dirname(path.resolve(input)));
    if (!rel || rel === '.' || rel.startsWith('..') || path.isAbsolute(rel)) return outputDir;
    return path.join(outputDir, rel);
}

export function outputPath(input, outputDir, mediaType, {
    stamp = false, meta = null, preferMtime = false, rootDir = null, sample = false,
} = {}) {
    const ext = mediaType === 'audio' ? '.mp3' : '.mp4';
    const dir = outputDirFor(input, outputDir, { rootDir });
    const name = stamp
        ? stampedOutputStem(path.basename(input), meta, { preferMtime })
        : path.basename(input, path.extname(input));
    const suffix = sample ? '.sample' : '';
    return path.join(dir, `${name}${suffix}${ext}`);
}

export function formatMtimeDate(input) {
    return fs.statSync(input).mtime.toISOString().slice(0, 10);
}

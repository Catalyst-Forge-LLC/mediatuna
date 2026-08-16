import fs from 'fs';
import path from 'path';
import { stampedOutputStem } from './stamp-dates.js';

export function outputPath(input, outputDir, mediaType, { stamp = false, meta = null, preferMtime = false } = {}) {
    const ext = mediaType === 'audio' ? '.mp3' : '.mp4';
    const dir = outputDir || path.dirname(input);
    const name = stamp
        ? stampedOutputStem(path.basename(input), meta, { preferMtime })
        : path.basename(input, path.extname(input));
    return path.join(dir, `${name}${ext}`);
}

export function formatMtimeDate(input) {
    return fs.statSync(input).mtime.toISOString().slice(0, 10);
}

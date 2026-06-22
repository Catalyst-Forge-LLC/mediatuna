import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { VIDEO_GLOB_PATTERN, AUDIO_GLOB_PATTERN } from './constants.js';
import { hasMediaExt } from './extensions.js';

export function getFlatFiles(target, mediaMode) {
    const files = [];
    for (const item of fs.readdirSync(target)) {
        const full = path.join(target, item);
        if (fs.statSync(full).isFile() && hasMediaExt(full, mediaMode)) files.push(full);
    }
    return files;
}

export function dedupeFiles(fileList) {
    return [...new Set(fileList.map(f => path.resolve(f)))].sort();
}

export async function discoverFiles(target, recursive, mediaMode) {
    let files = getFlatFiles(target, mediaMode);
    if (recursive) {
        const patterns = [];
        if (mediaMode.video) patterns.push(VIDEO_GLOB_PATTERN);
        if (mediaMode.audio) patterns.push(AUDIO_GLOB_PATTERN);
        for (const pattern of patterns) {
            const recFiles = await glob(pattern, { cwd: target, absolute: true, nocase: true });
            files = [...files, ...recFiles];
        }
        files = dedupeFiles(files);
    } else {
        files = dedupeFiles(files);
    }
    return files;
}

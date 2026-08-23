import path from 'path';
import fs from 'fs';
import { hasMediaExt } from './extensions.js';
import { discoverFiles } from './discover.js';
import { filterByGlobs } from './globs.js';

export function resolveInputFiles({ target, recursive, mediaMode, cwd = process.cwd() }) {
    const combinedMode = mediaMode.video && mediaMode.audio;
    const audioOnlyMode = mediaMode.audio && !mediaMode.video;

    if (target && fs.existsSync(target) && !fs.statSync(target).isDirectory()) {
        return {
            files: [path.resolve(target)],
            mode: 'single',
            targetPath: path.resolve(target),
            combinedMode,
            audioOnlyMode,
            videoOnlyMode: mediaMode.video && !mediaMode.audio,
        };
    }

    const targetPath = path.resolve(target || cwd);
    if (!fs.existsSync(targetPath)) {
        return { error: `path not found: ${targetPath}` };
    }
    if (!fs.statSync(targetPath).isDirectory()) {
        return { error: `not a file or folder: ${targetPath}` };
    }

    return {
        files: null,
        mode: 'folder',
        targetPath,
        recursive,
        combinedMode,
        audioOnlyMode,
        videoOnlyMode: mediaMode.video && !mediaMode.audio,
    };
}

export async function loadInputFiles(resolved, mediaMode, {
    stampDates = false, include = [], exclude = [],
} = {}) {
    if (resolved.files) {
        return filterByGlobs(resolved.files, {
            include,
            exclude,
            rootDir: path.dirname(resolved.files[0]),
        });
    }
    return discoverFiles(resolved.targetPath, resolved.recursive, mediaMode, { stampDates, include, exclude });
}

export function mediaModeHint({ combinedMode, audioOnlyMode }) {
    if (combinedMode) return 'video or audio files';
    if (audioOnlyMode) return 'audio files';
    return 'video files';
}

export function warnUnknownExtension(resolved, mediaMode, { stampDates = false } = {}) {
    if (resolved.mode !== 'single') return null;
    if (hasMediaExt(resolved.files[0], mediaMode, { stampDates })) return null;
    const expected = resolved.combinedMode ? 'video or audio' : resolved.audioOnlyMode ? 'audio' : 'video';
    return { file: path.basename(resolved.files[0]), expected };
}

export function formatUnknownExtensionError({ file, expected }) {
    return `${file} is not a known ${expected} extension. Folder scans skip unknown types; pass a supported media file.`;
}

export function buildModeParts({
    cleanupOriginals, stampDates, stampVideo = true, combinedMode, audioOnlyMode, nvenc, quality, deinterlace,
    mediaMode, preferMtime, embedArt, extractAudio, audioQuality, verify,
    deleteOriginals, deletePermanent = false, dryRun, resume, jobs = 1, dupeReport = false, dupeHash = false,
    recupMap = false, recupApply = false, archiveDir = null, sampleSeconds = null,
}) {
    if (recupMap) {
        const parts = ['recup-map'];
        if (recupApply) parts.push('apply');
        if (dupeHash) parts.push('hash');
        if (cleanupOriginals) parts.push('cleanup-originals');
        if (deletePermanent) parts.push('delete-permanent');
        if (dryRun) parts.push('dry-run');
        return parts;
    }

    if (dupeReport) {
        const parts = ['dupe-report'];
        if (dupeHash) parts.push('hash');
        if (dryRun) parts.push('dry-run');
        return parts;
    }

    if (stampDates) {
        const parts = ['stamp-dates'];
        if (preferMtime) parts.push('prefer-mtime');
        if (dryRun) parts.push('dry-run');
        return parts;
    }

    const modeParts = cleanupOriginals
        ? ['cleanup-originals', 'verify']
        : combinedMode
            ? ['video+audio', quality]
            : audioOnlyMode
                ? ['audio', quality]
                : [`${nvenc ? 'NVENC' : 'CPU'}`, quality];
    if (!cleanupOriginals && mediaMode.video) modeParts.push(deinterlace);
    if (!cleanupOriginals && mediaMode.video && stampVideo) modeParts.push('stamp');
    if (!cleanupOriginals && mediaMode.audio && preferMtime) modeParts.push('prefer-mtime');
    if (!cleanupOriginals && mediaMode.audio && !embedArt) modeParts.push('no-embed-art');
    if (extractAudio) modeParts.push('extract-audio');
    if (audioQuality !== quality) modeParts.push(`audio:${audioQuality}`);
    if (!cleanupOriginals && verify) modeParts.push('verify');
    if (deleteOriginals) modeParts.push('delete-originals');
    if (deletePermanent) modeParts.push('delete-permanent');
    if (archiveDir) modeParts.push('archive');
    if (sampleSeconds) modeParts.push(`sample:${sampleSeconds}s`);
    if (resume) modeParts.push('resume');
    if (jobs > 1) modeParts.push(`jobs:${jobs}`);
    if (dryRun) modeParts.push('dry-run');
    return modeParts;
}

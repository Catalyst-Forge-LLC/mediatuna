import fs from 'fs';
import path from 'path';
import { formatEntryStatus } from './status.js';

export const STATE_FILENAME = '.mediatuna-state.json';
export const STATE_VERSION = 1;

export function buildRunKey({
    outputDir, quality, audioQuality, deinterlace, mediaMode, extractAudio, verify,
    stampVideo = true, reencodeAudio = false,
}) {
    return JSON.stringify({
        outputDir: outputDir ?? null,
        quality,
        audioQuality,
        deinterlace,
        video: mediaMode.video,
        audio: mediaMode.audio,
        extractAudio,
        verify,
        stampVideo,
        reencodeAudio,
    });
}

export function defaultStatePath(logFile) {
    return path.join(path.dirname(logFile), STATE_FILENAME);
}

export function loadResumeState(statePath) {
    try {
        if (!fs.existsSync(statePath)) return null;
        const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (data?.version !== STATE_VERSION || !Array.isArray(data.completed)) return null;
        return {
            version: STATE_VERSION,
            runKey: data.runKey ?? '',
            completed: [...new Set(data.completed.map(p => path.resolve(p)))],
            updated: data.updated ?? null,
        };
    } catch {
        return null;
    }
}

export function createResumeState(runKey) {
    return {
        version: STATE_VERSION,
        runKey,
        completed: [],
        updated: null,
    };
}

export function saveResumeState(statePath, state) {
    const payload = {
        version: STATE_VERSION,
        runKey: state.runKey,
        completed: [...new Set(state.completed.map(p => path.resolve(p)))],
        updated: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(payload, null, 2) + '\n');
}

export function markCompleted(state, inputPath) {
    const resolved = path.resolve(inputPath);
    if (!state.completed.includes(resolved)) {
        state.completed.push(resolved);
    }
}

export function isMarkedCompleted(state, inputPath) {
    return state.completed.includes(path.resolve(inputPath));
}

export function entryNeedsWork(entry, mediaMode, extractAudio) {
    const { videoStatus, extractStatus, meta } = entry;
    if (videoStatus === 'unreadable') return false;
    if (videoStatus === 'skip (wrong type)' && !extractStatus) return false;

    let needs = false;
    if (meta.mediaType === 'video' && mediaMode.video && videoStatus !== 'skip (wrong type)') {
        if (videoStatus.startsWith('convert')) needs = true;
    } else if (meta.mediaType === 'audio' && mediaMode.audio) {
        if (videoStatus.startsWith('convert')) needs = true;
    }
    if (extractStatus && extractAudio && extractStatus.startsWith('convert')) {
        needs = true;
    }
    return needs;
}

export function verifyEntryOutputs(entry, verifyOutputFn) {
    const primaryType = entry.meta.mediaType === 'audio' ? 'audio' : 'video';
    if (entry.out && (entry.meta.mediaType === 'video' || entry.meta.mediaType === 'audio')) {
        if (!fs.existsSync(entry.out)) return { ok: false, reason: 'output missing' };
        const check = verifyOutputFn(entry.out, entry.meta.duration, primaryType);
        if (!check.ok) return check;
    }
    if (entry.audioOut && entry.extractStatus) {
        if (!fs.existsSync(entry.audioOut)) return { ok: false, reason: 'extract output missing' };
        const check = verifyOutputFn(entry.audioOut, entry.meta.duration, 'audio');
        if (!check.ok) return check;
    }
    return { ok: true };
}

export function shouldSkipResumed(entry, state, { mediaMode, extractAudio, verifyOutputFn, force = false }) {
    if (force) return false;
    if (!state || !isMarkedCompleted(state, entry.input)) return false;
    if (!entryNeedsWork(entry, mediaMode, extractAudio)) return false;
    const check = verifyEntryOutputs(entry, verifyOutputFn);
    return check.ok;
}

export function applyResumeToPreflight(preflight, state, options) {
    if (!state || !options.resume) return { entries: preflight, resumed: 0 };
    let resumed = 0;
    const entries = preflight.map(entry => {
        if (!shouldSkipResumed(entry, state, options)) return entry;
        resumed++;
        const videoStatus = entry.videoStatus.startsWith('convert') ? 'skip (resumed)' : entry.videoStatus;
        let extractStatus = entry.extractStatus;
        if (extractStatus?.startsWith('convert')) {
            extractStatus = 'skip (resumed)';
        }
        return {
            ...entry,
            videoStatus,
            extractStatus,
            status: formatEntryStatus(videoStatus, extractStatus),
        };
    });
    return { entries, resumed };
}

import fs from 'fs';
import path from 'path';
import { isNormalizedMp3, isSourceMp3 } from './audio-policy.js';
import { isLossyAudioSource } from './extensions.js';

export function isConvertStatus(status) {
    return status.startsWith('convert') || status.includes('+ mp3') || status.includes('→ mp3');
}

export function isSkippableStatus(status) {
    return status.includes('skip (exists)') || status.includes('skip (normalized)');
}

export function matchesMediaMode(meta, mediaMode) {
    if (mediaMode.audio && !mediaMode.video) return meta.mediaType === 'audio';
    if (mediaMode.video && !mediaMode.audio) return meta.mediaType === 'video';
    return meta.mediaType === 'video' || meta.mediaType === 'audio';
}

export function classifyStatus(input, meta, out, force, mediaMode, audioQuality) {
    if (!meta.valid) return 'unreadable';
    if (!matchesMediaMode(meta, mediaMode)) return 'skip (wrong type)';
    if (meta.mediaType === 'audio') {
        if (!force && isSourceMp3(input, meta) && isNormalizedMp3(input, meta, audioQuality)) {
            if (path.resolve(input) === path.resolve(out) || fs.existsSync(out)) {
                return 'skip (normalized)';
            }
        }
    }
    if (!force && fs.existsSync(out)) return 'skip (exists)';
    if (meta.mediaType === 'audio') {
        return isLossyAudioSource(input) ? 'convert → mp3 [lossy]' : 'convert → mp3';
    }
    return 'convert → mp4';
}

export function classifyExtractStatus(_input, _meta, audioOut, force, _audioQuality) {
    if (!force && fs.existsSync(audioOut)) return 'skip (exists)';
    return 'convert → mp3 [extract]';
}

export function formatEntryStatus(videoStatus, extractStatus) {
    if (!extractStatus) return videoStatus;
    if (extractStatus.startsWith('convert')) {
        return videoStatus.startsWith('convert') || videoStatus.startsWith('would convert')
            ? `${videoStatus} + mp3 extract`
            : `${videoStatus}; ${extractStatus}`;
    }
    if (videoStatus.startsWith('skip') && extractStatus.startsWith('skip')) {
        return `${videoStatus}; mp3 ${extractStatus.replace('skip ', '')}`;
    }
    return `${videoStatus}; ${extractStatus}`;
}

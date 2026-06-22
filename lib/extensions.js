import path from 'path';
import { VIDEO_EXTS, AUDIO_EXTS, LOSSLESS_AUDIO_EXTS } from './constants.js';

export function hasVideoExt(filePath) {
    return VIDEO_EXTS.has(path.extname(filePath).toLowerCase());
}

export function hasAudioExt(filePath) {
    return AUDIO_EXTS.has(path.extname(filePath).toLowerCase());
}

export function hasMediaExt(filePath, mediaMode) {
    const ext = path.extname(filePath).toLowerCase();
    if (mediaMode.video && VIDEO_EXTS.has(ext)) return true;
    if (mediaMode.audio && AUDIO_EXTS.has(ext)) return true;
    return false;
}

export function isLossyAudioSource(input) {
    return LOSSLESS_AUDIO_EXTS.has(path.extname(input).toLowerCase());
}

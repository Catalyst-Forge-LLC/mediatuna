import fs from 'fs';
import { execFileSync } from 'child_process';
import { INTERLACED_FIELD_ORDERS } from './constants.js';
import { extractTagInfo } from './tags.js';

export function parseProbeResult(data, stats) {
    let duration = 0;
    let creation = 'N/A';
    let mediaType = 'unreadable';
    let interlaced = false;
    let fieldOrder = 'unknown';
    let tags = {};
    let tagCount = 0;
    let hasCoverArt = false;
    let audioCodec = 'unknown';
    let audioBitrate = 0;

    duration = parseFloat(data.format?.duration) || 0;
    tags = data.format?.tags || {};
    tagCount = extractTagInfo(tags).tagCount;
    creation = tags.creation_time || tags.date || tags.DATE || tags.year || 'N/A';

    const videoStreams = data.streams?.filter(s => s.codec_type === 'video') ?? [];
    const audioStream = data.streams?.find(s => s.codec_type === 'audio');

    if (audioStream) {
        audioCodec = (audioStream.codec_name || 'unknown').toLowerCase();
        audioBitrate = parseInt(audioStream.bit_rate, 10)
            || parseInt(data.format?.bit_rate, 10)
            || 0;
    }

    hasCoverArt = videoStreams.some(s => Number(s.disposition?.attached_pic) === 1);
    const primaryVideo = videoStreams.find(s => Number(s.disposition?.attached_pic) !== 1);

    if (primaryVideo) {
        mediaType = 'video';
        fieldOrder = (primaryVideo.field_order || 'unknown').toLowerCase();
        interlaced = INTERLACED_FIELD_ORDERS.has(fieldOrder);
    } else if (audioStream) {
        mediaType = 'audio';
    }

    return {
        duration,
        creation_time: creation,
        modified_time: stats.mtime.toISOString(),
        size: stats.size,
        valid: mediaType !== 'unreadable',
        mediaType,
        interlaced,
        field_order: fieldOrder,
        tags,
        tagCount,
        hasCoverArt,
        audioCodec,
        audioBitrate,
    };
}

export function probeFile(input) {
    const stats = fs.statSync(input);
    try {
        const out = execFileSync(
            'ffprobe',
            ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
        return parseProbeResult(JSON.parse(out), stats);
    } catch {
        return parseProbeResult({}, stats);
    }
}

export function getMetadata(input) {
    return probeFile(input);
}

export function getFormatTags(filePath) {
    try {
        const out = execFileSync(
            'ffprobe',
            ['-v', 'error', '-print_format', 'json', '-show_format', filePath],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const data = JSON.parse(out);
        return extractTagInfo(data.format?.tags || {});
    } catch {
        return extractTagInfo({});
    }
}

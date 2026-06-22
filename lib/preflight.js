import path from 'path';
import {
    classifyStatus,
    classifyExtractStatus,
    formatEntryStatus,
} from './status.js';
import { isLossyAudioSource } from './extensions.js';
import { formatSize, padEnd } from './format.js';
import { outputPath } from './paths.js';
import { getMetadata } from './probe.js';
import { secondsToHMS } from './time.js';

export function buildPreflightTableLines(entries, dryRun) {
    const nameW = Math.min(40, Math.max(20, ...entries.map(e => path.basename(e.input).length)));
    const header = `  ${padEnd('File', nameW)}  ${padEnd('Type', 5)}  ${padEnd('Duration', 10)}  ${padEnd('Size', 10)}  Status`;
    const rule = '  ' + '─'.repeat(nameW + 44);
    const lines = ['', rule, header, rule];

    const counts = { convert: 0, skip: 0, unreadable: 0, wrong: 0 };

    for (const e of entries) {
        let status = e.status;
        if (dryRun && status.startsWith('convert')) status = status.replace('convert', 'would convert');
        if (status === 'unreadable') counts.unreadable++;
        else if (status.includes('skip (exists)') || status.includes('skip (normalized)')) counts.skip++;
        else if (status.includes('skip (wrong type)')) counts.wrong++;
        else counts.convert++;

        lines.push(
            `  ${padEnd(path.basename(e.input), nameW)}  ${padEnd(e.meta.mediaType, 5)}  ${padEnd(secondsToHMS(e.meta.duration), 10)}  ${padEnd(formatSize(e.meta.size), 10)}  ${status}`
        );
    }

    lines.push(rule);
    const action = dryRun ? 'would convert' : 'to convert';
    const wrongNote = counts.wrong > 0 ? `, ${counts.wrong} wrong type` : '';
    lines.push(`  ${entries.length} file(s): ${counts.convert} ${action}, ${counts.skip} skip, ${counts.unreadable} unreadable${wrongNote}`);
    lines.push('');

    return { lines, counts };
}

export async function buildPreflightEntries(fileList, outputDir, force, mediaMode, { audioQuality, extractAudio, onProbeProgress } = {}) {
    const entries = [];
    for (let i = 0; i < fileList.length; i++) {
        const input = fileList[i];
        onProbeProgress?.(i + 1, fileList.length);
        const meta = getMetadata(input);
        const out = outputPath(input, outputDir, meta.mediaType === 'audio' ? 'audio' : 'video');
        const videoStatus = classifyStatus(input, meta, out, force, mediaMode, audioQuality);
        let audioOut = null;
        let extractStatus = null;
        if (extractAudio && meta.mediaType === 'video' && mediaMode.video) {
            audioOut = outputPath(input, outputDir, 'audio');
            extractStatus = classifyExtractStatus(input, meta, audioOut, force, audioQuality);
        }
        entries.push({
            input,
            out,
            audioOut,
            meta,
            status: formatEntryStatus(videoStatus, extractStatus),
            videoStatus,
            extractStatus,
            lossy: meta.mediaType === 'audio' && isLossyAudioSource(input),
        });
    }
    return entries;
}

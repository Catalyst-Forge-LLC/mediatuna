import fs from 'fs';
import { execFile, execFileSync } from 'child_process';
import { lameQuality } from './audio-policy.js';
import { formatFfmpegError } from './format.js';
import { formatMtimeDate } from './paths.js';
import { hasDateTag } from './tags.js';
import { NVENC_MIN_HEIGHT, NVENC_MIN_WIDTH } from './constants.js';
import { timeToSeconds } from './time.js';

export function nvencSupportsFrame(meta) {
    const width = Number(meta?.width) || 0;
    const height = Number(meta?.height) || 0;
    if (width <= 0 || height <= 0) return true;
    return width >= NVENC_MIN_WIDTH && height >= NVENC_MIN_HEIGHT;
}

export function shouldDeinterlace(mode, meta) {
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return meta.interlaced;
}

export function buildVideoFilter(deinterlaceMode, meta) {
    if (!shouldDeinterlace(deinterlaceMode, meta)) return null;
    return 'yadif';
}

export function buildFfmpegArgs(input, out, meta, { quality, nvenc, deinterlaceMode }) {
    const args = ['-hide_banner', '-loglevel', 'info', '-n', '-i', input, '-map_metadata', '0'];

    const vf = buildVideoFilter(deinterlaceMode, meta);
    if (vf) args.push('-vf', vf);

    args.push('-pix_fmt', 'yuv420p', '-movflags', '+faststart');

    if (nvenc && nvencSupportsFrame(meta)) {
        const p = quality === 'high' ? 'p7' : quality === 'fast' ? 'p4' : 'p6';
        const cq = quality === 'high' ? '15' : '18';
        args.push('-c:v', 'h264_nvenc', '-preset', p, '-cq', cq, '-c:a', 'aac', '-b:a', '192k');
    } else {
        const crf = quality === 'high' ? '16' : quality === 'fast' ? '23' : '18';
        args.push('-c:v', 'libx264', '-crf', crf, '-preset', quality === 'fast' ? 'medium' : 'slow', '-c:a', 'aac', '-b:a', '192k');
    }

    args.push(out);
    return args;
}

export function buildAudioFfmpegArgs(input, out, { audioQuality, embedArt, preferMtime, meta }) {
    const args = [
        '-hide_banner', '-loglevel', 'info', '-n', '-i', input,
        '-map_metadata', '0',
        '-id3v2_version', '3',
        '-write_id3v1', '0',
    ];

    if (preferMtime && !hasDateTag(meta.tags)) {
        args.push('-metadata', `date=${formatMtimeDate(input)}`);
    }

    args.push('-map', '0:a:0', '-c:a', 'libmp3lame', '-q:a', lameQuality(audioQuality));

    if (embedArt) {
        args.push('-map', '0:v?', '-c:v', 'copy', '-disposition:v:0', 'attached_pic');
    }

    args.push(out);
    return args;
}

export function buildExtractAudioFfmpegArgs(input, out, { audioQuality, preferMtime, meta }) {
    const args = [
        '-hide_banner', '-loglevel', 'info', '-n', '-i', input,
        '-map_metadata', '0',
        '-id3v2_version', '3',
        '-write_id3v1', '0',
    ];

    if (preferMtime && !hasDateTag(meta.tags)) {
        args.push('-metadata', `date=${formatMtimeDate(input)}`);
    }

    args.push('-map', '0:a:0', '-c:a', 'libmp3lame', '-q:a', lameQuality(audioQuality), out);
    return args;
}

export function copyWindowsTimestamps(input, output) {
    execFileSync('powershell', [
        '-NoProfile', '-Command',
        `$i = ${JSON.stringify(input)}; $o = ${JSON.stringify(output)}; `
        + '$src = Get-Item -LiteralPath $i; $dst = Get-Item -LiteralPath $o; '
        + '$dst.CreationTime = $src.CreationTime; $dst.LastWriteTime = $src.LastWriteTime',
    ], { stdio: 'ignore' });
}

export function removePartialOutput(outPath, keepPartial, onRemoved) {
    if (keepPartial || !fs.existsSync(outPath)) return;
    try {
        fs.unlinkSync(outPath);
        onRemoved?.(`Removed incomplete output: ${outPath}`);
    } catch (err) {
        onRemoved?.(`Could not remove incomplete output: ${outPath} (${err.message})`);
    }
}

export function runFfmpeg(args, { onProgress, setActiveProc } = {}) {
    return new Promise((resolve, reject) => {
        let stderrBuf = '';
        const proc = execFile('ffmpeg', args, { maxBuffer: 1024 * 1024 * 100 }, (err) => {
            setActiveProc?.(null);
            if (err) reject(new Error(formatFfmpegError(stderrBuf, err.message)));
            else resolve(stderrBuf);
        });
        setActiveProc?.(proc);
        proc.stderr?.on('data', (data) => {
            const chunk = data.toString();
            stderrBuf += chunk;
            onProgress?.(chunk, stderrBuf);
        });
    });
}

export function detectNvenc() {
    try {
        const encoders = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8', stdio: 'pipe' });
        return encoders.includes('h264_nvenc');
    } catch {
        return false;
    }
}

export function applyOutputTimestamps(input, out) {
    const s = fs.statSync(input);
    fs.utimesSync(out, s.atime, s.mtime);
    if (process.platform === 'win32') copyWindowsTimestamps(input, out);
}

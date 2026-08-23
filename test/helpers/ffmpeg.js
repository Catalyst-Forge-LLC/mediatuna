import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const indexJs = fileURLToPath(new URL('../../index.js', import.meta.url));

export function ffmpegAvailable() {
    try {
        execFileSync('ffmpeg', ['-hide_banner', '-version'], { stdio: 'ignore' });
        execFileSync('ffprobe', ['-hide_banner', '-version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

export function shouldRunFfmpegTests() {
    const required = process.env.MEDIATUNA_FFMPEG_TESTS === '1';
    const available = ffmpegAvailable();
    if (required && !available) {
        throw new Error('MEDIATUNA_FFMPEG_TESTS=1 but ffmpeg/ffprobe were not found on PATH');
    }
    return available;
}

export function writeLavfiVideo(dest, { seconds = 5 } = {}) {
    execFileSync('ffmpeg', [
        '-hide_banner', '-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', `color=c=blue:s=320x240:r=10:d=${seconds}`,
        '-f', 'lavfi', '-i', `sine=f=440:d=${seconds}`,
        '-c:v', 'mpeg4', '-c:a', 'mp2',
        dest,
    ], { stdio: 'ignore' });
}

export function writeTaggedMp3(dest, { seconds = 3 } = {}) {
    execFileSync('ffmpeg', [
        '-hide_banner', '-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', `sine=f=440:d=${seconds}`,
        '-c:a', 'libmp3lame', '-b:a', '192k',
        '-metadata', 'title=MediaTuna test',
        '-metadata', 'artist=Suite',
        dest,
    ], { stdio: 'ignore' });
}

export function probeDuration(filePath) {
    const out = execFileSync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
    ], { encoding: 'utf8' });
    return parseFloat(out);
}

export function runMediatuna(args, { cwd } = {}) {
    return spawnSync(process.execPath, [indexJs, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env },
    });
}

export function convertArgs(extra, { cwd, logName = 'mediatuna-log.txt' } = {}) {
    return [
        '--yes',
        '--no-master-log',
        '--no-stamp-dates',
        '--quality', 'fast',
        '--log', path.join(cwd, logName),
        ...extra,
    ];
}

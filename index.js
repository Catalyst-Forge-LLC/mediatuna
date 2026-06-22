#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'node:util';
import { execFile, execFileSync } from 'child_process';
import { glob } from 'glob';
import cliProgress from 'cli-progress';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const VIDEO_EXTS = new Set(['.avi', '.mov', '.mod', '.vob', '.mts', '.m2ts', '.mpg', '.mpeg']);
const GLOB_PATTERN = '**/*.{avi,mov,mod,vob,mts,m2ts,mpg,mpeg}';
const VALID_QUALITY = new Set(['high', 'medium', 'fast']);

const HELP = `VidTuna — batch convert legacy video to MP4

Usage: vidtuna [path] [options]

Arguments:
  path                 File or folder to convert (default: current directory)

Options:
  -h, --help           Show this help
  -V, --version        Show version and script path
  --dry-run            Preview actions without encoding
  --recursive          Scan subfolders for video files
  --flat               Scan top-level folder only (default)
  --output <folder>    Write MP4s to a different folder
  --log <file>         Append log to this file (default: ./vidtuna-log.txt)
  --quality <preset>   high | medium | fast (default: medium)
  --force              Overwrite existing MP4s

Supported formats: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG

Requires ffmpeg and ffprobe on PATH.

Exit codes: 0 success, 1 encode/read failures, 2 usage or missing dependencies, 130 interrupted
`;

function parseCli() {
    try {
        const { values, positionals } = parseArgs({
            args: process.argv.slice(2),
            options: {
                help: { type: 'boolean', short: 'h' },
                version: { type: 'boolean', short: 'V' },
                force: { type: 'boolean' },
                'dry-run': { type: 'boolean' },
                recursive: { type: 'boolean' },
                flat: { type: 'boolean' },
                output: { type: 'string' },
                log: { type: 'string' },
                quality: { type: 'string', default: 'medium' },
            },
            allowPositionals: true,
            strict: true,
        });

        if (values.help) {
            console.log(HELP);
            process.exit(0);
        }

        if (values.version) {
            console.log(`vidtuna ${pkg.version}`);
            console.log(`Script: ${fileURLToPath(import.meta.url)}`);
            process.exit(0);
        }

        if (values.recursive && values.flat) {
            console.error('Error: --recursive and --flat cannot be used together.');
            process.exit(2);
        }

        const quality = values.quality.toLowerCase();
        if (!VALID_QUALITY.has(quality)) {
            console.error(`Error: invalid quality "${values.quality}". Use: high, medium, fast`);
            process.exit(2);
        }

        if (values.output !== undefined && !values.output.trim()) {
            console.error('Error: --output requires a folder path.');
            process.exit(2);
        }

        if (values.log !== undefined && !values.log.trim()) {
            console.error('Error: --log requires a file path.');
            process.exit(2);
        }

        const target = positionals[0] ?? null;
        if (positionals.length > 1) {
            console.error(`Error: unexpected extra arguments: ${positionals.slice(1).join(' ')}`);
            process.exit(2);
        }

        return {
            force: values.force ?? false,
            dryRun: values['dry-run'] ?? false,
            recursive: values.recursive ?? false,
            outputDir: values.output ? path.resolve(values.output) : null,
            logFile: values.log ? path.resolve(values.log) : path.join(process.cwd(), 'vidtuna-log.txt'),
            quality,
            target,
        };
    } catch (err) {
        if (err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
            console.error(`Error: ${err.message}`);
            console.error('Run vidtuna --help for usage.');
            process.exit(2);
        }
        throw err;
    }
}

function requireTools() {
    const missing = [];
    for (const tool of ['ffmpeg', 'ffprobe']) {
        try {
            execFileSync(tool, ['-version'], { stdio: 'pipe' });
        } catch {
            missing.push(tool);
        }
    }
    if (missing.length > 0) {
        console.error(`Error: required tools not found on PATH: ${missing.join(', ')}`);
        console.error('Install ffmpeg (includes ffprobe) and ensure it is on PATH.');
        process.exit(2);
    }
}

const cli = parseCli();
requireTools();

const LOG_FILE = cli.logFile;
const FAILED_REPORT = path.join(path.dirname(LOG_FILE), 'vidtuna-failed.txt');

let multibar = null;
let activeProc = null;
let shuttingDown = false;

function appendLog(msg) {
    const ts = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`);
}

function log(msg) {
    appendLog(msg);
    if (multibar?.isActive) multibar.log(msg + '\n');
    else console.log(msg);
}

function logDetail(msg) {
    appendLog(msg);
}

function fileLog(msg, index, total) {
    const prefix = total > 1 ? `[${index + 1}/${total}] ` : '';
    log(prefix + msg);
}

function cleanupProgress() {
    if (multibar?.isActive) multibar.stop();
}

process.on('SIGINT', () => {
    if (shuttingDown) process.exit(130);
    shuttingDown = true;
    console.error('\nInterrupted.');
    activeProc?.kill('SIGTERM');
    cleanupProgress();
    process.exit(130);
});

function secondsToHMS(seconds) {
    const s = Math.floor(Math.max(0, Number(seconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatHMSValue(v, _options, type) {
    if (type === 'value' || type === 'total') return secondsToHMS(v);
    return v;
}

function formatTimeHMS(t, _options, _round) {
    if (t === 'NULL' || t === 'INF' || t == null || Number.isNaN(Number(t))) return '--:--:--';
    return secondsToHMS(t);
}

function formatSize(bytes) {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
    return `${bytes} B`;
}

function padEnd(str, len) {
    const s = String(str);
    return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function hasVideoExt(filePath) {
    return VIDEO_EXTS.has(path.extname(filePath).toLowerCase());
}

function getFlatFiles(target) {
    const files = [];
    for (const item of fs.readdirSync(target)) {
        const full = path.join(target, item);
        if (fs.statSync(full).isFile() && hasVideoExt(full)) files.push(full);
    }
    return files;
}

function dedupeFiles(fileList) {
    return [...new Set(fileList.map(f => path.resolve(f)))].sort();
}

async function discoverFiles(target, recursive) {
    let files = getFlatFiles(target);
    if (recursive) {
        log(' (recursive mode)');
        const recFiles = await glob(GLOB_PATTERN, { cwd: target, absolute: true, nocase: true });
        files = dedupeFiles([...files, ...recFiles]);
    } else {
        files = dedupeFiles(files);
    }
    return files;
}

function formatFfmpegError(stderr, fallback) {
    const lines = stderr
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .filter(l =>
            !l.startsWith('ffmpeg version') &&
            !l.startsWith('built with') &&
            !l.startsWith('configuration:') &&
            !/^lib\w+\s+\d/.test(l)
        );
    return lines.at(-1) || fallback;
}

function shellQuote(arg) {
    return /[\s"'$`]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const last = parseFloat(parts[parts.length - 1]) || 0;
    if (parts.length === 3) {
        return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + Math.floor(last);
    }
    if (parts.length === 2) {
        return (parseInt(parts[0], 10) || 0) * 60 + Math.floor(last);
    }
    return Math.floor(last);
}

function getMetadata(input) {
    const stats = fs.statSync(input);
    let duration = 0;
    let creation = 'N/A';
    let valid = false;
    try {
        const out = execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input], { encoding: 'utf8' });
        const data = JSON.parse(out);
        duration = parseFloat(data.format?.duration) || 0;
        creation = data.format?.tags?.creation_time || data.format?.tags?.date || 'N/A';
        valid = Array.isArray(data.streams) && data.streams.some(s => s.codec_type === 'video');
    } catch { }
    return {
        duration,
        creation_time: creation,
        modified_time: stats.mtime.toISOString(),
        size: stats.size,
        valid,
    };
}

function outputPath(input, outputDir) {
    const dir = outputDir || path.dirname(input);
    const name = path.basename(input, path.extname(input));
    return path.join(dir, `${name}.mp4`);
}

function classifyStatus(meta, out, force) {
    if (!meta.valid) return 'unreadable';
    if (!force && fs.existsSync(out)) return 'skip (exists)';
    return 'convert';
}

function printPreflightTable(entries, dryRun) {
    const nameW = Math.min(40, Math.max(20, ...entries.map(e => path.basename(e.input).length)));
    const header = `  ${padEnd('File', nameW)}  ${padEnd('Duration', 10)}  ${padEnd('Size', 10)}  Status`;
    const rule = '  ' + '─'.repeat(nameW + 36);
    const lines = ['', rule, header, rule];

    const counts = { convert: 0, skip: 0, unreadable: 0 };

    for (const e of entries) {
        let status = e.status;
        if (dryRun) {
            if (status === 'convert') status = 'would convert';
        }
        if (status === 'unreadable') counts.unreadable++;
        else if (status.includes('skip')) counts.skip++;
        else counts.convert++;

        lines.push(
            `  ${padEnd(path.basename(e.input), nameW)}  ${padEnd(secondsToHMS(e.meta.duration), 10)}  ${padEnd(formatSize(e.meta.size), 10)}  ${status}`
        );
    }

    lines.push(rule);
    const action = dryRun ? 'would convert' : 'to convert';
    lines.push(`  ${entries.length} file(s): ${counts.convert} ${action}, ${counts.skip} skip (exists), ${counts.unreadable} unreadable`);
    lines.push('');

    for (const line of lines) {
        if (line === '') console.log('');
        else console.log(line);
        appendLog(line);
    }
}

async function buildPreflightEntries(fileList, outputDir, force) {
    const entries = [];
    for (let i = 0; i < fileList.length; i++) {
        const input = fileList[i];
        if (fileList.length > 1) {
            process.stdout.write(`\rProbing ${i + 1}/${fileList.length}...`);
        }
        const meta = getMetadata(input);
        const out = outputPath(input, outputDir);
        entries.push({ input, out, meta, status: classifyStatus(meta, out, force) });
    }
    if (fileList.length > 1) process.stdout.write('\r' + ' '.repeat(30) + '\r');
    return entries;
}

// --- discover inputs ---

let files = [];
const { target: arg, recursive, dryRun, force, outputDir, quality } = cli;

if (arg && fs.existsSync(arg) && !fs.statSync(arg).isDirectory()) {
    const resolved = path.resolve(arg);
    if (!hasVideoExt(resolved)) {
        log(`Warning: ${path.basename(resolved)} is not a known video extension; attempting anyway.`);
    }
    files = [resolved];
    log(`Single file mode: ${path.basename(arg)}`);
} else {
    const target = path.resolve(arg || process.cwd());
    if (!fs.existsSync(target)) {
        console.error(`Error: path not found: ${target}`);
        process.exit(2);
    }
    if (!fs.statSync(target).isDirectory()) {
        console.error(`Error: not a file or folder: ${target}`);
        process.exit(2);
    }
    log(`Scanning folder: ${target}`);
    files = await discoverFiles(target, recursive);
}

if (files.length === 0) {
    log('No files found. Try --recursive.');
    process.exit(0);
}

log(`Log file: ${LOG_FILE}`);

// NVENC detection
let nvenc = false;
try {
    const encoders = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8', stdio: 'pipe' });
    if (encoders.includes('h264_nvenc')) nvenc = true;
} catch { }

log(`Found ${files.length} file(s). GPU: ${nvenc ? 'NVENC' : 'CPU'} | Quality: ${quality}${dryRun ? ' | DRY-RUN' : ''}`);

const preflight = await buildPreflightEntries(files, outputDir, force);
printPreflightTable(preflight, dryRun);

log('');

const barDefaults = {
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: false,
};

multibar = dryRun ? null : new cliProgress.MultiBar(barDefaults);

const overallBar = !dryRun && files.length > 1
    ? multibar.create(files.length, 0, {}, {
        format: 'Overall [{bar}] {percentage}% | {value}/{total} files',
    })
    : null;

let fileBar = null;

const start = Date.now();
let done = 0, skipped = 0, failed = 0;
const failedPaths = [];

async function processFile(entry, index) {
    if (shuttingDown) return;

    const { input, out, meta } = entry;
    const total = preflight.length;

    fileLog(
        `Processing: ${path.basename(input)} | Duration: ${secondsToHMS(meta.duration)} | Created: ${meta.creation_time} | Updated: ${meta.modified_time}`,
        dryRun ? index : -1,
        dryRun ? total : 0
    );

    if (!meta.valid) {
        fileLog(`Unreadable: ${path.basename(input)} (ffprobe could not read this file)`, dryRun ? index : -1, dryRun ? total : 0);
        failed++;
        failedPaths.push(input);
        if (overallBar) overallBar.increment();
        return;
    }

    if (dryRun) {
        if (!force && fs.existsSync(out)) {
            fileLog(`[DRY] Skip (exists): ${path.basename(input)}`, index, total);
            skipped++;
        } else {
            fileLog(`[DRY] Would convert: ${path.basename(input)} → ${path.basename(out)}`, index, total);
            done++;
        }
        return;
    }

    if (!force && fs.existsSync(out)) {
        fileLog(`Skipped: ${path.basename(input)}`, -1, 0);
        skipped++;
        if (overallBar) overallBar.increment();
        return;
    }

    if (!fs.existsSync(path.dirname(out))) fs.mkdirSync(path.dirname(out), { recursive: true });

    const activeFileBar = meta.duration > 0 ? (fileBar ??= multibar.create(Math.floor(meta.duration), 0, {
        filename: path.basename(input),
    }, {
        format: 'Current [{bar}] {percentage}% | {value} / {total} | ETA {eta_formatted} | {filename}',
        formatValue: formatHMSValue,
        formatTime: formatTimeHMS,
    })) : null;

    if (activeFileBar) activeFileBar.start(Math.floor(meta.duration), 0, { filename: path.basename(input) });

    const args = [
        '-hide_banner', '-loglevel', 'info',
        '-n', '-i', input,
        '-vf', 'yadif', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    ];

    if (nvenc) {
        const p = quality === 'high' ? 'p7' : quality === 'fast' ? 'p4' : 'p6';
        const cq = quality === 'high' ? '15' : '18';
        args.push('-c:v', 'h264_nvenc', '-preset', p, '-cq', cq, '-c:a', 'aac', '-b:a', '192k');
    } else {
        const crf = quality === 'high' ? '16' : quality === 'fast' ? '23' : '18';
        args.push('-c:v', 'libx264', '-crf', crf, '-preset', quality === 'fast' ? 'medium' : 'slow', '-c:a', 'aac', '-b:a', '192k');
    }
    args.push(out);

    log(`--- ${path.basename(input)} ---`);
    logDetail(`Command: ffmpeg ${args.map(shellQuote).join(' ')}`);
    const encodeStart = Date.now();

    return new Promise((resolve) => {
        let stderrBuf = '';
        let lastSpeed = null;

        const proc = execFile('ffmpeg', args, { maxBuffer: 1024 * 1024 * 100 }, (err) => {
            activeProc = null;
            const elapsedSec = (Date.now() - encodeStart) / 1000;
            const elapsedStr = elapsedSec >= 60
                ? `${Math.floor(elapsedSec / 60)}m ${Math.round(elapsedSec % 60)}s`
                : `${elapsedSec.toFixed(1)}s`;

            if (err) {
                const detail = formatFfmpegError(stderrBuf, err.message);
                log(`Error: ${path.basename(input)} - ${detail}`);
                logDetail(`stderr:\n${stderrBuf.trim()}`);
                logDetail(`--- end ${path.basename(input)} (${elapsedStr}, failed) ---`);
                failed++;
                failedPaths.push(input);
            } else {
                try {
                    const s = fs.statSync(input);
                    fs.utimesSync(out, s.atime, s.mtime);
                    if (process.platform === 'win32') {
                        const cmd = `$o=Get-Item '${input.replace(/'/g, "''")}'; $n=Get-Item '${out.replace(/'/g, "''")}'; $n.CreationTime=$o.CreationTime; $n.LastWriteTime=$o.LastWriteTime;`;
                        execFileSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'ignore' });
                    }
                } catch { }
                const speedNote = lastSpeed ? `, avg ${lastSpeed}x` : '';
                log(`✓ ${path.basename(out)} | Metadata copied (Created: ${meta.creation_time} | Updated: ${meta.modified_time})`);
                logDetail(`--- end ${path.basename(input)} (${elapsedStr}${speedNote}) ---`);
                done++;
            }
            if (activeFileBar) activeFileBar.update(Math.floor(meta.duration));
            if (overallBar) overallBar.increment();
            resolve();
        });

        activeProc = proc;

        proc.stderr?.on('data', (data) => {
            const chunk = data.toString();
            stderrBuf += chunk;

            const speedMatch = chunk.match(/speed=\s*([\d.]+)x/);
            if (speedMatch) lastSpeed = speedMatch[1];

            if (chunk.includes('time=')) {
                const timeMatch = chunk.match(/time=([\d:.]+)/);
                if (timeMatch && activeFileBar) {
                    const current = timeToSeconds(timeMatch[1]);
                    if (!Number.isNaN(current)) activeFileBar.update(current);
                }
            }
        });
    });
}

for (let i = 0; i < preflight.length; i++) {
    if (shuttingDown) break;
    await processFile(preflight[i], i);
}

cleanupProgress();

if (failedPaths.length > 0) {
    fs.writeFileSync(FAILED_REPORT, failedPaths.map(p => path.resolve(p)).join('\n') + '\n');
    log(`Failed files list: ${FAILED_REPORT}`);
}

const mins = ((Date.now() - start) / 1000 / 60).toFixed(1);
const dryLabel = dryRun ? ' (dry-run)' : '';
const doneLabel = dryRun ? 'would convert' : 'converted';
log(`=== VidTuna Complete${dryLabel}: ${done} ${doneLabel}, ${skipped} skipped, ${failed} failed, ${mins} minutes ===`);

process.exit(failed > 0 ? 1 : 0);

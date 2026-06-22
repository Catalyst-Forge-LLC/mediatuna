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
const VALID_DEINTERLACE = new Set(['auto', 'on', 'off']);
const INTERLACED_FIELD_ORDERS = new Set(['tt', 'bb', 'tb', 'bt']);

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
  --deinterlace <mode> auto | on | off (default: auto)
  --no-verify          Skip post-encode output verification
  --keep-partial       Keep incomplete MP4 on encode failure
  --force              Overwrite existing MP4s
  --verbose            Show per-file details on console (default: quiet)

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
                deinterlace: { type: 'string', default: 'auto' },
                'no-verify': { type: 'boolean' },
                'keep-partial': { type: 'boolean' },
                verbose: { type: 'boolean' },
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

        const deinterlace = values.deinterlace.toLowerCase();
        if (!VALID_DEINTERLACE.has(deinterlace)) {
            console.error(`Error: invalid deinterlace mode "${values.deinterlace}". Use: auto, on, off`);
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
            deinterlace,
            verify: !(values['no-verify'] ?? false),
            keepPartial: values['keep-partial'] ?? false,
            verbose: values.verbose ?? false,
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

function logFile(msg) {
    appendLog(msg);
}

function logToConsole(msg) {
    if (multibar?.isActive) multibar.log(msg + '\n');
    else console.log(msg);
}

function logConsole(msg) {
    logFile(msg);
    logToConsole(msg);
}

function logVerbose(msg) {
    logFile(msg);
    if (verbose) logToConsole(msg);
}

function fileLog(msg, index, total) {
    const prefix = total > 1 ? `[${index + 1}/${total}] ` : '';
    logVerbose(prefix + msg);
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
        logFile(' (recursive mode)');
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
    let interlaced = false;
    let fieldOrder = 'unknown';
    try {
        const out = execFileSync(
            'ffprobe',
            ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const data = JSON.parse(out);
        duration = parseFloat(data.format?.duration) || 0;
        creation = data.format?.tags?.creation_time || data.format?.tags?.date || 'N/A';
        const videoStream = data.streams?.find(s => s.codec_type === 'video');
        valid = Boolean(videoStream);
        fieldOrder = (videoStream?.field_order || 'unknown').toLowerCase();
        interlaced = INTERLACED_FIELD_ORDERS.has(fieldOrder);
    } catch { }
    return {
        duration,
        creation_time: creation,
        modified_time: stats.mtime.toISOString(),
        size: stats.size,
        valid,
        interlaced,
        field_order: fieldOrder,
    };
}

function outputPath(input, outputDir) {
    const dir = outputDir || path.dirname(input);
    const name = path.basename(input, path.extname(input));
    return path.join(dir, `${name}.mp4`);
}

function shouldDeinterlace(mode, meta) {
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return meta.interlaced;
}

function buildVideoFilter(deinterlaceMode, meta) {
    if (!shouldDeinterlace(deinterlaceMode, meta)) return null;
    return 'yadif';
}

function copyWindowsTimestamps(input, output) {
    execFileSync('powershell', [
        '-NoProfile', '-Command',
        `$i = ${JSON.stringify(input)}; $o = ${JSON.stringify(output)}; `
        + '$src = Get-Item -LiteralPath $i; $dst = Get-Item -LiteralPath $o; '
        + '$dst.CreationTime = $src.CreationTime; $dst.LastWriteTime = $src.LastWriteTime',
    ], { stdio: 'ignore' });
}

function removePartialOutput(outPath, keepPartial) {
    if (keepPartial || !fs.existsSync(outPath)) return;
    try {
        fs.unlinkSync(outPath);
        logFile(`Removed incomplete output: ${outPath}`);
    } catch (err) {
        logFile(`Could not remove incomplete output: ${outPath} (${err.message})`);
    }
}

function verifyOutput(outPath, expectedDuration) {
    const meta = getMetadata(outPath);
    if (!meta.valid) {
        return { ok: false, reason: 'output file is unreadable' };
    }
    if (expectedDuration > 0 && meta.duration > 0) {
        const diff = Math.abs(meta.duration - expectedDuration);
        const tolerance = Math.max(2, expectedDuration * 0.05);
        if (diff > tolerance) {
            return {
                ok: false,
                reason: `duration mismatch (source ${expectedDuration.toFixed(1)}s, output ${meta.duration.toFixed(1)}s)`,
            };
        }
    }
    return { ok: true, duration: meta.duration };
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
        if (dryRun && status === 'convert') status = 'would convert';
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
            process.stderr.write(`\rProbing ${i + 1}/${fileList.length}...`);
        }
        const meta = getMetadata(input);
        const out = outputPath(input, outputDir);
        entries.push({ input, out, meta, status: classifyStatus(meta, out, force) });
    }
    if (fileList.length > 1) process.stderr.write('\r' + ' '.repeat(40) + '\r');
    return entries;
}

function buildFfmpegArgs(input, out, meta, { quality, nvenc, deinterlaceMode }) {
    const args = ['-hide_banner', '-loglevel', 'info', '-n', '-i', input, '-map_metadata', '0'];

    const vf = buildVideoFilter(deinterlaceMode, meta);
    if (vf) args.push('-vf', vf);

    args.push('-pix_fmt', 'yuv420p', '-movflags', '+faststart');

    if (nvenc) {
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

// --- discover inputs ---

let files = [];
const { target: arg, recursive, dryRun, force, outputDir, quality, deinterlace, verify, keepPartial, verbose } = cli;

if (arg && fs.existsSync(arg) && !fs.statSync(arg).isDirectory()) {
    const resolved = path.resolve(arg);
    if (!hasVideoExt(resolved)) {
        logConsole(`Warning: ${path.basename(resolved)} is not a known video extension; attempting anyway.`);
    }
    files = [resolved];
    logFile(`Single file mode: ${path.basename(arg)}`);
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
    logFile(`Scanning folder: ${target}`);
    files = await discoverFiles(target, recursive);
}

if (files.length === 0) {
    logConsole('No files found. Try --recursive.');
    process.exit(0);
}

let nvenc = false;
try {
    const encoders = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8', stdio: 'pipe' });
    if (encoders.includes('h264_nvenc')) nvenc = true;
} catch { }

logFile(`Log file: ${LOG_FILE}`);

const modeParts = [`${nvenc ? 'NVENC' : 'CPU'}`, quality, deinterlace];
if (verify) modeParts.push('verify');
if (dryRun) modeParts.push('dry-run');
logConsole(`VidTuna: ${files.length} files | ${modeParts.join(' | ')}`);

const preflight = await buildPreflightEntries(files, outputDir, force);
printPreflightTable(preflight, dryRun);

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

    const { input, out, meta, status } = entry;
    const total = preflight.length;
    const base = path.basename(input);

    logFile(`Processing: ${base} | Duration: ${secondsToHMS(meta.duration)} | Created: ${meta.creation_time} | Updated: ${meta.modified_time}`);

    if (status === 'unreadable') {
        failed++;
        failedPaths.push(input);
        logConsole(`Unreadable: ${base}`);
        if (overallBar) overallBar.increment();
        return;
    }

    if (dryRun) {
        if (status === 'skip (exists)') skipped++;
        else {
            done++;
            if (verbose) {
                const deinterlaceNote = shouldDeinterlace(deinterlace, meta) ? 'yadif' : 'none';
                fileLog(`Would convert: ${base} → ${path.basename(out)} (deinterlace: ${deinterlaceNote})`, index, total);
            }
        }
        return;
    }

    if (status === 'skip (exists)') {
        skipped++;
        logFile(`Skipped: ${base}`);
        if (overallBar) overallBar.increment();
        return;
    }

    if (meta.duration <= 0) {
        logFile(`[WARN] ${base}: zero duration reported; progress may be approximate`);
        if (verbose) logConsole(`[WARN] ${base}: zero duration reported; progress may be approximate`);
    }

    if (!fs.existsSync(path.dirname(out))) fs.mkdirSync(path.dirname(out), { recursive: true });

    const knownDuration = meta.duration > 0;
    const barTotal = knownDuration ? Math.floor(meta.duration) : 3600;
    const activeFileBar = fileBar ??= multibar.create(barTotal, 0, {
        filename: path.basename(input),
    }, {
        format: 'Current [{bar}] {percentage}% | {value} / {total} | ETA {eta_formatted} | {filename}',
        formatValue: formatHMSValue,
        formatTime: formatTimeHMS,
    });

    activeFileBar.start(barTotal, 0, { filename: path.basename(input) });

    const args = buildFfmpegArgs(input, out, meta, { quality, nvenc, deinterlaceMode: deinterlace });
    const deinterlaceApplied = shouldDeinterlace(deinterlace, meta);
    logFile(`--- ${base} ---`);
    logFile(`Deinterlace: ${deinterlaceApplied ? 'yadif' : 'off'} (mode=${deinterlace}, field_order=${meta.field_order})`);
    logFile(`Command: ffmpeg ${args.map(shellQuote).join(' ')}`);
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

            const failEncode = (message) => {
                logConsole(`Error: ${base} - ${message}`);
                logFile(`stderr:\n${stderrBuf.trim()}`);
                logFile(`--- end ${base} (${elapsedStr}, failed) ---`);
                removePartialOutput(out, keepPartial);
                failed++;
                failedPaths.push(input);
            };

            if (err) {
                failEncode(formatFfmpegError(stderrBuf, err.message));
            } else if (verify) {
                const check = verifyOutput(out, meta.duration);
                if (!check.ok) {
                    failEncode(`verification failed: ${check.reason}`);
                } else {
                    try {
                        const s = fs.statSync(input);
                        fs.utimesSync(out, s.atime, s.mtime);
                        if (process.platform === 'win32') copyWindowsTimestamps(input, out);
                    } catch { }
                    const speedNote = lastSpeed ? `, avg ${lastSpeed}x` : '';
                    const outBase = path.basename(out);
                    const detail = `✓ ${outBase} | Verified (${secondsToHMS(check.duration)}) | Metadata copied`;
                    logFile(`${detail}${speedNote ? ` | ${speedNote.slice(2)}` : ''}`);
                    logFile(`--- end ${base} (${elapsedStr}${speedNote}) ---`);
                    logToConsole(verbose ? detail : `✓ ${outBase}`);
                    done++;
                }
            } else {
                try {
                    const s = fs.statSync(input);
                    fs.utimesSync(out, s.atime, s.mtime);
                    if (process.platform === 'win32') copyWindowsTimestamps(input, out);
                } catch { }
                const speedNote = lastSpeed ? `, avg ${lastSpeed}x` : '';
                const outBase = path.basename(out);
                const detail = `✓ ${outBase} | Metadata copied (Created: ${meta.creation_time} | Updated: ${meta.modified_time})`;
                logFile(`${detail}${speedNote ? ` | ${speedNote.slice(2)}` : ''}`);
                logFile(`--- end ${base} (${elapsedStr}${speedNote}) ---`);
                logToConsole(verbose ? detail : `✓ ${outBase}`);
                done++;
            }

            if (activeFileBar) activeFileBar.update(knownDuration ? Math.floor(meta.duration) : activeFileBar.value);
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
                    if (!Number.isNaN(current)) {
                        if (!knownDuration && current > activeFileBar.getTotal()) {
                            activeFileBar.setTotal(current + 60);
                        }
                        activeFileBar.update(current);
                    }
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
    logConsole(`Failed files list: ${FAILED_REPORT}`);
}

const mins = ((Date.now() - start) / 1000 / 60).toFixed(1);
const dryLabel = dryRun ? ' (dry-run)' : '';
const doneLabel = dryRun ? 'would convert' : 'converted';
logConsole(`=== VidTuna Complete${dryLabel}: ${done} ${doneLabel}, ${skipped} skipped, ${failed} failed, ${mins} minutes ===`);

process.exit(failed > 0 ? 1 : 0);

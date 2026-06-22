#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';
import { stdin as input, stdout as output } from 'process';
import { parseArgs } from 'node:util';
import { execFile, execFileSync } from 'child_process';
import { glob } from 'glob';
import cliProgress from 'cli-progress';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const VIDEO_EXTS = new Set(['.avi', '.mov', '.mod', '.vob', '.mts', '.m2ts', '.mpg', '.mpeg']);
const AUDIO_EXTS = new Set([
    '.mp3', '.flac', '.wav', '.aiff', '.aif', '.ape', '.m4a', '.aac', '.alac',
    '.ogg', '.opus', '.wma', '.ac3', '.dts',
]);
const LOSSLESS_AUDIO_EXTS = new Set(['.flac', '.wav', '.aiff', '.aif', '.ape']);
const VIDEO_GLOB_PATTERN = '**/*.{avi,mov,mod,vob,mts,m2ts,mpg,mpeg}';
const AUDIO_GLOB_PATTERN = '**/*.{mp3,flac,wav,aiff,aif,ape,m4a,aac,alac,ogg,opus,wma,ac3,dts}';
const VALID_QUALITY = new Set(['high', 'medium', 'fast']);
const VALID_DEINTERLACE = new Set(['auto', 'on', 'off']);
const INTERLACED_FIELD_ORDERS = new Set(['tt', 'bb', 'tb', 'bt']);

const HELP = `MediaTuna — batch convert legacy media to MP4 and MP3

Usage: mediatuna [path] [options]

Arguments:
  path                 File or folder to convert (default: current directory)

Options:
  -h, --help           Show this help
  -V, --version        Show version and script path
  --dry-run            Preview actions without encoding
  --recursive          Scan subfolders
  --flat               Scan top-level folder only (default)
  --video-only         Process video files only (default)
  --audio-only         Process audio files only (FLAC, WAV, M4A, MP3, … → MP3)
  --output <folder>    Write outputs to a different folder
  --log <file>         Append log to this file (default: ./mediatuna-log.txt)
  --no-master-log      Do not mirror log to ~/.mediatuna/history.log
  --master-log <file>  Custom master log path (still mirrors run log)
  --delete-originals   Delete sources after successful conversion (interactive)
  --quality <preset>   high | medium | fast (default: medium)
  --deinterlace <mode> auto | on | off (default: auto; video only)
  --no-verify          Skip post-encode output verification
  --keep-partial       Keep incomplete output on encode failure
  --force              Overwrite existing outputs
  --verbose            Show per-file details on console (default: quiet)
  --prefer-mtime       Use file modified date as date tag when source has none
  --embed-art          Embed album cover in MP3 when present (default)
  --no-embed-art       Skip embedding album cover in MP3

Video formats: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG → MP4
Audio formats: MP3, FLAC, WAV, AIFF, M4A, AAC, OGG, Opus, WMA, AC3, DTS → MP3

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
                'master-log': { type: 'string' },
                'no-master-log': { type: 'boolean' },
                'delete-originals': { type: 'boolean' },
                quality: { type: 'string', default: 'medium' },
                deinterlace: { type: 'string', default: 'auto' },
                'no-verify': { type: 'boolean' },
                'keep-partial': { type: 'boolean' },
                verbose: { type: 'boolean' },
                'video-only': { type: 'boolean' },
                'audio-only': { type: 'boolean' },
                'prefer-mtime': { type: 'boolean' },
                'embed-art': { type: 'boolean' },
                'no-embed-art': { type: 'boolean' },
            },
            allowPositionals: true,
            strict: true,
        });

        if (values.help) {
            console.log(HELP);
            process.exit(0);
        }

        if (values.version) {
            console.log(`mediatuna ${pkg.version}`);
            console.log(`Script: ${fileURLToPath(import.meta.url)}`);
            process.exit(0);
        }

        if (values.recursive && values.flat) {
            console.error('Error: --recursive and --flat cannot be used together.');
            process.exit(2);
        }

        if (values['audio-only'] && values['video-only']) {
            console.error('Error: --audio-only and --video-only cannot be used together.');
            process.exit(2);
        }

        if (values['embed-art'] && values['no-embed-art']) {
            console.error('Error: --embed-art and --no-embed-art cannot be used together.');
            process.exit(2);
        }

        const mediaMode = values['audio-only']
            ? { video: false, audio: true }
            : { video: true, audio: false };

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

        if (values['master-log'] !== undefined && !values['master-log'].trim()) {
            console.error('Error: --master-log requires a file path.');
            process.exit(2);
        }

        if (values['delete-originals'] && values['no-verify']) {
            console.error('Error: --delete-originals requires post-encode verification (omit --no-verify).');
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
            logFile: values.log ? path.resolve(values.log) : path.join(process.cwd(), 'mediatuna-log.txt'),
            masterLogEnabled: !(values['no-master-log'] ?? false),
            masterLogFile: values['master-log']
                ? path.resolve(values['master-log'])
                : path.join(os.homedir(), '.mediatuna', 'history.log'),
            deleteOriginals: values['delete-originals'] ?? false,
            quality,
            deinterlace,
            verify: !(values['no-verify'] ?? false),
            keepPartial: values['keep-partial'] ?? false,
            verbose: values.verbose ?? false,
            mediaMode,
            preferMtime: values['prefer-mtime'] ?? false,
            embedArt: values['no-embed-art'] ? false : (values['embed-art'] ?? true),
            target,
        };
    } catch (err) {
        if (err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
            console.error(`Error: ${err.message}`);
            console.error('Run mediatuna --help for usage.');
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
const MASTER_LOG_FILE = cli.masterLogFile;
const MASTER_LOG_ENABLED = cli.masterLogEnabled;
const FAILED_REPORT = path.join(path.dirname(LOG_FILE), 'mediatuna-failed.txt');

function ensureLogDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

ensureLogDir(LOG_FILE);
if (MASTER_LOG_ENABLED) ensureLogDir(MASTER_LOG_FILE);

let multibar = null;
let activeProc = null;
let shuttingDown = false;
let masterLogWarningShown = false;

function appendLog(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line);
    if (MASTER_LOG_ENABLED) {
        try {
            fs.appendFileSync(MASTER_LOG_FILE, line);
        } catch (err) {
            if (!masterLogWarningShown) {
                masterLogWarningShown = true;
                console.error(`Warning: could not write master log (${MASTER_LOG_FILE}): ${err.message}`);
            }
        }
    }
}

async function promptLine(question) {
    const rl = readline.createInterface({ input, output });
    try {
        return (await rl.question(question)).trim();
    } finally {
        rl.close();
    }
}

function isConvertStatus(status) {
    return status.startsWith('convert');
}

function printDeletePlan(candidates, dryRunLabel = false) {
    const prefix = dryRunLabel ? '[DRY] ' : '';
    const lines = [
        '',
        `${prefix}--delete-originals: sources below will be PERMANENTLY DELETED after successful conversion.`,
        `${prefix}Skipped, failed, or unreadable files are never deleted.`,
        '',
    ];
    const showMax = 25;
    for (const [i, entry] of candidates.entries()) {
        if (i >= showMax) {
            lines.push(`  ... and ${candidates.length - showMax} more`);
            break;
        }
        lines.push(`  ${entry.input}`);
        lines.push(`    → ${entry.out}`);
    }
    lines.push('');
    lines.push(`${prefix}${candidates.length} file(s) eligible for deletion after success.`);
    lines.push('');
    for (const line of lines) {
        if (line === '') console.log('');
        else console.log(line);
        appendLog(line);
    }
}

async function confirmDeleteOriginals(candidates) {
    if (!input.isTTY || !output.isTTY) {
        console.error('Error: --delete-originals requires an interactive terminal.');
        process.exit(2);
    }

    printDeletePlan(candidates);

    const first = await promptLine('Delete these originals after successful conversion? [y/N]: ');
    if (!/^y(es)?$/i.test(first)) return false;

    const second = await promptLine('Type DELETE to confirm permanent deletion: ');
    if (second !== 'DELETE') return false;

    logConsole('Delete originals confirmed.');
    return true;
}

function deleteOriginalFiles(paths) {
    let deleted = 0;
    let deleteFailed = 0;
    for (const filePath of paths) {
        try {
            if (!fs.existsSync(filePath)) continue;
            fs.unlinkSync(filePath);
            logConsole(`Deleted original: ${filePath}`);
            deleted++;
        } catch (err) {
            logConsole(`Error deleting ${filePath}: ${err.message}`);
            deleteFailed++;
        }
    }
    return { deleted, deleteFailed };
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

function hasAudioExt(filePath) {
    return AUDIO_EXTS.has(path.extname(filePath).toLowerCase());
}

function hasMediaExt(filePath, mediaMode) {
    if (mediaMode.audio && !mediaMode.video) return hasAudioExt(filePath);
    return hasVideoExt(filePath);
}

function isLossyAudioSource(input) {
    return LOSSLESS_AUDIO_EXTS.has(path.extname(input).toLowerCase());
}

function getFlatFiles(target, mediaMode) {
    const files = [];
    for (const item of fs.readdirSync(target)) {
        const full = path.join(target, item);
        if (fs.statSync(full).isFile() && hasMediaExt(full, mediaMode)) files.push(full);
    }
    return files;
}

function dedupeFiles(fileList) {
    return [...new Set(fileList.map(f => path.resolve(f)))].sort();
}

async function discoverFiles(target, recursive, mediaMode) {
    let files = getFlatFiles(target, mediaMode);
    if (recursive) {
        logFile(' (recursive mode)');
        const pattern = mediaMode.audio && !mediaMode.video ? AUDIO_GLOB_PATTERN : VIDEO_GLOB_PATTERN;
        const recFiles = await glob(pattern, { cwd: target, absolute: true, nocase: true });
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

const DATE_TAG_KEYS = new Set(['date', 'creation_time', 'year', 'tdrc', 'tdor', 'originaldate']);
const IMPORTANT_TAG_NAMES = ['title', 'artist', 'album', 'date', 'genre'];

function normalizeTagKey(key) {
    const lower = key.toLowerCase();
    const colon = lower.lastIndexOf(':');
    return colon >= 0 ? lower.slice(colon + 1) : lower;
}

function extractTagInfo(tags = {}) {
    const entries = Object.entries(tags).filter(([, v]) => v != null && String(v).trim() !== '');
    return {
        tags,
        tagKeys: entries.map(([k]) => k),
        tagCount: entries.length,
    };
}

function findTagValue(tags, name) {
    const target = name.toLowerCase();
    for (const [key, value] of Object.entries(tags)) {
        if (normalizeTagKey(key) === target) return String(value).trim();
    }
    return null;
}

function hasDateTag(tags) {
    for (const key of Object.keys(tags)) {
        if (DATE_TAG_KEYS.has(normalizeTagKey(key))) {
            const value = String(tags[key]).trim();
            if (value && value !== 'N/A') return true;
        }
    }
    return false;
}

function formatMtimeDate(input) {
    return fs.statSync(input).mtime.toISOString().slice(0, 10);
}

function probeFile(input) {
    const stats = fs.statSync(input);
    let duration = 0;
    let creation = 'N/A';
    let valid = false;
    let mediaType = 'unreadable';
    let interlaced = false;
    let fieldOrder = 'unknown';
    let tags = {};
    let tagCount = 0;
    let hasCoverArt = false;
    try {
        const out = execFileSync(
            'ffprobe',
            ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const data = JSON.parse(out);
        duration = parseFloat(data.format?.duration) || 0;
        tags = data.format?.tags || {};
        tagCount = extractTagInfo(tags).tagCount;
        creation = tags.creation_time || tags.date || tags.DATE || tags.year || 'N/A';
        const videoStreams = data.streams?.filter(s => s.codec_type === 'video') ?? [];
        const audioStream = data.streams?.find(s => s.codec_type === 'audio');
        hasCoverArt = videoStreams.some(s => Number(s.disposition?.attached_pic) === 1);
        const primaryVideo = videoStreams.find(s => Number(s.disposition?.attached_pic) !== 1);
        if (primaryVideo) {
            mediaType = 'video';
            fieldOrder = (primaryVideo.field_order || 'unknown').toLowerCase();
            interlaced = INTERLACED_FIELD_ORDERS.has(fieldOrder);
        } else if (audioStream) {
            mediaType = 'audio';
        }
        valid = mediaType !== 'unreadable';
    } catch { }
    return {
        duration,
        creation_time: creation,
        modified_time: stats.mtime.toISOString(),
        size: stats.size,
        valid,
        mediaType,
        interlaced,
        field_order: fieldOrder,
        tags,
        tagCount,
        hasCoverArt,
    };
}

function getMetadata(input) {
    return probeFile(input);
}

function getFormatTags(filePath) {
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

function verifyAudioTags(sourceMeta, outPath) {
    const warnings = [];
    const dest = getFormatTags(outPath);
    const dropped = sourceMeta.tagCount - dest.tagCount;
    if (dropped >= 3) {
        warnings.push(`${dropped} tags dropped (${sourceMeta.tagCount} → ${dest.tagCount})`);
    }
    for (const name of IMPORTANT_TAG_NAMES) {
        if (findTagValue(sourceMeta.tags, name) && !findTagValue(dest.tags, name)) {
            warnings.push(`missing ${name} tag in output`);
        }
    }
    return warnings;
}

function outputPath(input, outputDir, mediaType) {
    const ext = mediaType === 'audio' ? '.mp3' : '.mp4';
    const dir = outputDir || path.dirname(input);
    const name = path.basename(input, path.extname(input));
    return path.join(dir, `${name}${ext}`);
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

function verifyOutput(outPath, expectedDuration, expectedType = 'video', verifyContext = null) {
    const meta = getMetadata(outPath);
    if (meta.mediaType !== expectedType) {
        return { ok: false, reason: expectedType === 'audio' ? 'output file has no audio stream' : 'output file is unreadable' };
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

    const warnings = [];
    if (expectedType === 'audio' && verifyContext?.sourceMeta) {
        warnings.push(...verifyAudioTags(verifyContext.sourceMeta, outPath));
        if (verifyContext.sourceSize) {
            const outSize = fs.statSync(outPath).size;
            if (outSize === 0) {
                return { ok: false, reason: 'output file is empty' };
            }
            if (outSize > verifyContext.sourceSize * 10) {
                warnings.push(`output (${formatSize(outSize)}) unusually large vs source (${formatSize(verifyContext.sourceSize)})`);
            }
        }
    }

    return { ok: true, duration: meta.duration, warnings };
}

function matchesMediaMode(meta, mediaMode) {
    if (mediaMode.audio && !mediaMode.video) return meta.mediaType === 'audio';
    if (mediaMode.video && !mediaMode.audio) return meta.mediaType === 'video';
    return meta.mediaType === 'video' || meta.mediaType === 'audio';
}

function classifyStatus(input, meta, out, force, mediaMode) {
    if (!meta.valid) return 'unreadable';
    if (!matchesMediaMode(meta, mediaMode)) return 'skip (wrong type)';
    if (!force && fs.existsSync(out)) return 'skip (exists)';
    if (meta.mediaType === 'audio') {
        return isLossyAudioSource(input) ? 'convert → mp3 [lossy]' : 'convert → mp3';
    }
    return 'convert → mp4';
}

function printPreflightTable(entries, dryRun) {
    const nameW = Math.min(40, Math.max(20, ...entries.map(e => path.basename(e.input).length)));
    const header = `  ${padEnd('File', nameW)}  ${padEnd('Type', 5)}  ${padEnd('Duration', 10)}  ${padEnd('Size', 10)}  Status`;
    const rule = '  ' + '─'.repeat(nameW + 44);
    const lines = ['', rule, header, rule];

    const counts = { convert: 0, skip: 0, unreadable: 0, wrong: 0 };

    for (const e of entries) {
        let status = e.status;
        if (dryRun && status.startsWith('convert')) status = status.replace('convert', 'would convert');
        if (status === 'unreadable') counts.unreadable++;
        else if (status.includes('skip (exists)')) counts.skip++;
        else if (status.includes('skip (wrong type)')) counts.wrong++;
        else counts.convert++;

        lines.push(
            `  ${padEnd(path.basename(e.input), nameW)}  ${padEnd(e.meta.mediaType, 5)}  ${padEnd(secondsToHMS(e.meta.duration), 10)}  ${padEnd(formatSize(e.meta.size), 10)}  ${status}`
        );
    }

    lines.push(rule);
    const action = dryRun ? 'would convert' : 'to convert';
    const wrongNote = counts.wrong > 0 ? `, ${counts.wrong} wrong type` : '';
    lines.push(`  ${entries.length} file(s): ${counts.convert} ${action}, ${counts.skip} skip (exists), ${counts.unreadable} unreadable${wrongNote}`);
    lines.push('');

    for (const line of lines) {
        if (line === '') console.log('');
        else console.log(line);
        appendLog(line);
    }
}

async function buildPreflightEntries(fileList, outputDir, force, mediaMode) {
    const entries = [];
    for (let i = 0; i < fileList.length; i++) {
        const input = fileList[i];
        if (fileList.length > 1) {
            process.stderr.write(`\rProbing ${i + 1}/${fileList.length}...`);
        }
        const meta = getMetadata(input);
        const out = outputPath(input, outputDir, meta.mediaType === 'audio' ? 'audio' : 'video');
        entries.push({
            input,
            out,
            meta,
            status: classifyStatus(input, meta, out, force, mediaMode),
            lossy: meta.mediaType === 'audio' && isLossyAudioSource(input),
        });
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

function lameQuality(quality) {
    if (quality === 'high') return '0';
    if (quality === 'fast') return '4';
    return '2';
}

function buildAudioFfmpegArgs(input, out, { quality, embedArt, preferMtime, meta }) {
    const args = [
        '-hide_banner', '-loglevel', 'info', '-n', '-i', input,
        '-map_metadata', '0',
        '-id3v2_version', '3',
        '-write_id3v1', '0',
    ];

    if (preferMtime && !hasDateTag(meta.tags)) {
        args.push('-metadata', `date=${formatMtimeDate(input)}`);
    }

    args.push('-map', '0:a:0', '-c:a', 'libmp3lame', '-q:a', lameQuality(quality));

    if (embedArt) {
        args.push('-map', '0:v?', '-c:v', 'copy', '-disposition:v:0', 'attached_pic');
    }

    args.push(out);
    return args;
}

// --- discover inputs ---

let files = [];
const {
    target: arg, recursive, dryRun, force, outputDir, quality, deinterlace,
    verify, keepPartial, verbose, mediaMode, preferMtime, embedArt, deleteOriginals,
} = cli;

const audioMode = mediaMode.audio && !mediaMode.video;

if (arg && fs.existsSync(arg) && !fs.statSync(arg).isDirectory()) {
    const resolved = path.resolve(arg);
    if (!hasMediaExt(resolved, mediaMode)) {
        const expected = audioMode ? 'audio' : 'video';
        logConsole(`Warning: ${path.basename(resolved)} is not a known ${expected} extension; attempting anyway.`);
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
    files = await discoverFiles(target, recursive, mediaMode);
}

if (files.length === 0) {
    const hint = audioMode ? 'audio files' : 'video files';
    logConsole(`No ${hint} found. Try --recursive.`);
    process.exit(0);
}

let nvenc = false;
if (!audioMode) {
    try {
        const encoders = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8', stdio: 'pipe' });
        if (encoders.includes('h264_nvenc')) nvenc = true;
    } catch { }
}

logFile(`Log file: ${LOG_FILE}`);
if (MASTER_LOG_ENABLED) logFile(`Master log: ${MASTER_LOG_FILE}`);

const modeParts = [audioMode ? 'audio' : `${nvenc ? 'NVENC' : 'CPU'}`, quality];
if (!audioMode) modeParts.push(deinterlace);
if (audioMode && preferMtime) modeParts.push('prefer-mtime');
if (audioMode && !embedArt) modeParts.push('no-embed-art');
if (verify) modeParts.push('verify');
if (deleteOriginals) modeParts.push('delete-originals');
if (dryRun) modeParts.push('dry-run');
logConsole(`MediaTuna: ${files.length} files | ${modeParts.join(' | ')}`);

const preflight = await buildPreflightEntries(files, outputDir, force, mediaMode);
printPreflightTable(preflight, dryRun);

const deleteCandidates = preflight.filter(e => isConvertStatus(e.status));
let deleteOriginalsConfirmed = false;

if (deleteOriginals) {
    if (deleteCandidates.length === 0) {
        logConsole('No files marked for conversion; --delete-originals has no effect.');
    } else if (dryRun) {
        printDeletePlan(deleteCandidates, true);
    } else {
        deleteOriginalsConfirmed = await confirmDeleteOriginals(deleteCandidates);
        if (!deleteOriginalsConfirmed) {
            logConsole('Delete originals cancelled.');
            process.exit(0);
        }
    }
}

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
const convertedInputs = [];

async function processFile(entry, index) {
    if (shuttingDown) return;

    const { input, out, meta, status, lossy } = entry;
    const total = preflight.length;
    const base = path.basename(input);
    const isAudio = meta.mediaType === 'audio';

    logFile(`Processing: ${base} | Type: ${meta.mediaType} | Duration: ${secondsToHMS(meta.duration)} | Created: ${meta.creation_time} | Updated: ${meta.modified_time}`);

    if (status === 'unreadable') {
        failed++;
        failedPaths.push(input);
        logConsole(`Unreadable: ${base}`);
        if (overallBar) overallBar.increment();
        return;
    }

    if (status === 'skip (wrong type)') {
        skipped++;
        logFile(`Skipped (wrong type): ${base}`);
        if (overallBar) overallBar.increment();
        return;
    }

    if (dryRun) {
        if (status === 'skip (exists)') skipped++;
        else {
            done++;
            if (verbose) {
                const detail = isAudio
                    ? `${lossy ? ' (lossy)' : ''}`
                    : ` (deinterlace: ${shouldDeinterlace(deinterlace, meta) ? 'yadif' : 'none'})`;
                fileLog(`Would convert: ${base} → ${path.basename(out)}${detail}`, index, total);
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

    if (lossy) {
        const msg = `[WARN] ${base} → ${path.basename(out)} (lossy; source cannot be recovered from MP3)`;
        logFile(msg);
        if (verbose) logConsole(msg);
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

    const args = isAudio
        ? buildAudioFfmpegArgs(input, out, { quality, embedArt, preferMtime, meta })
        : buildFfmpegArgs(input, out, meta, { quality, nvenc, deinterlaceMode: deinterlace });
    const deinterlaceApplied = !isAudio && shouldDeinterlace(deinterlace, meta);
    logFile(`--- ${base} ---`);
    if (isAudio) {
        const artNote = embedArt ? (meta.hasCoverArt ? 'embed cover' : 'embed cover if present') : 'no cover';
        const dateNote = preferMtime && !hasDateTag(meta.tags) ? `date=${formatMtimeDate(input)} from mtime` : 'tags as-is';
        logFile(`Encode: libmp3lame -q:a ${lameQuality(quality)} | ${artNote} | ${dateNote}`);
    } else {
        logFile(`Deinterlace: ${deinterlaceApplied ? 'yadif' : 'off'} (mode=${deinterlace}, field_order=${meta.field_order})`);
    }
    logFile(`Command: ffmpeg ${args.map(shellQuote).join(' ')}`);
    const encodeStart = Date.now();
    const expectedType = isAudio ? 'audio' : 'video';

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
                const verifyContext = isAudio ? { sourceMeta: meta, sourceSize: meta.size } : null;
                const check = verifyOutput(out, meta.duration, expectedType, verifyContext);
                if (!check.ok) {
                    failEncode(`verification failed: ${check.reason}`);
                } else {
                    for (const warning of check.warnings ?? []) {
                        logFile(`[WARN] ${base}: ${warning}`);
                        if (verbose) logConsole(`[WARN] ${base}: ${warning}`);
                    }
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
                    convertedInputs.push(input);
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
                convertedInputs.push(input);
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

let deleteFailed = 0;
if (deleteOriginalsConfirmed && convertedInputs.length > 0) {
    const { deleted, deleteFailed: delFail } = deleteOriginalFiles(convertedInputs);
    deleteFailed = delFail;
    logConsole(`=== Deleted ${deleted} original(s), ${delFail} delete error(s) ===`);
} else if (deleteOriginals && dryRun && deleteCandidates.length > 0) {
    logConsole(`=== Would delete up to ${deleteCandidates.length} original(s) after successful conversion (dry-run) ===`);
}

const mins = ((Date.now() - start) / 1000 / 60).toFixed(1);
const dryLabel = dryRun ? ' (dry-run)' : '';
const doneLabel = dryRun ? 'would convert' : 'converted';
logConsole(`=== MediaTuna Complete${dryLabel}: ${done} ${doneLabel}, ${skipped} skipped, ${failed} failed, ${mins} minutes ===`);

process.exit(failed > 0 || deleteFailed > 0 ? 1 : 0);

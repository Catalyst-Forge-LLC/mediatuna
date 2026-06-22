#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';
import { stdin as input, stdout as output } from 'process';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { lameQuality } from './lib/audio-policy.js';
import { buildCliConfig, CLI_PARSE_OPTIONS, CliConfigError } from './lib/cli-config.js';
import { discoverFiles } from './lib/discover.js';
import {
    applyOutputTimestamps,
    buildAudioFfmpegArgs,
    buildExtractAudioFfmpegArgs,
    buildFfmpegArgs,
    detectNvenc,
    removePartialOutput,
    runFfmpeg,
    shouldDeinterlace,
} from './lib/encode.js';
import { hasMediaExt } from './lib/extensions.js';
import { shellQuote } from './lib/format.js';
import { formatMtimeDate } from './lib/paths.js';
import { buildPreflightEntries, buildPreflightTableLines } from './lib/preflight.js';
import {
    isConvertStatus,
    isSkippableStatus,
} from './lib/status.js';
import { hasDateTag } from './lib/tags.js';
import { secondsToHMS, formatHMSValue, formatTimeHMS, timeToSeconds } from './lib/time.js';
import { requireTools as missingTools } from './lib/tools.js';
import { verifyOutput } from './lib/verify.js';

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
  --video-only         Process video files only
  --audio-only         Process audio files only
  --output <folder>    Write outputs to a different folder
  --log <file>         Append log to this file (default: ./mediatuna-log.txt)
  --no-master-log      Do not mirror log to ~/.mediatuna/history.log
  --master-log <file>  Custom master log path (still mirrors run log)
  --delete-originals   After conversion: delete sources that converted successfully (interactive)
  --cleanup-originals  Delete sources whose outputs already exist (run after converting)
  --quality <preset>   high | medium | fast (default: medium; video + default audio)
  --audio-quality <preset>  Audio LAME preset (default: same as --quality)
  --extract-audio      Also write MP3 from video files (audio track only)
  --deinterlace <mode> auto | on | off (default: auto; video only)
  --no-verify          Skip post-encode output verification
  --keep-partial       Keep incomplete output on encode failure
  --force              Overwrite existing outputs
  --verbose            Show per-file details on console (default: quiet)
  --prefer-mtime       Use file modified date as date tag when source has none
  --embed-art          Embed album cover in MP3 when present (default)
  --no-embed-art       Skip embedding album cover in MP3

Video formats: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG, WMV, 3GP, 3G2 → MP4
Audio formats: MP3, FLAC, WAV, AIFF, M4A, AAC, OGG, Opus, WMA, AC3, DTS → MP3

Requires ffmpeg and ffprobe on PATH.

Exit codes: 0 success, 1 encode/read failures, 2 usage or missing dependencies, 130 interrupted
`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

function parseCli() {
    try {
        const { values, positionals } = parseArgs({
            args: process.argv.slice(2),
            options: CLI_PARSE_OPTIONS,
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

        return buildCliConfig(values, positionals);
    } catch (err) {
        if (err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
            console.error(`Error: ${err.message}`);
            console.error('Run mediatuna --help for usage.');
            process.exit(2);
        }
        if (err instanceof CliConfigError) {
            console.error(`Error: ${err.message}`);
            process.exit(2);
        }
        throw err;
    }
}

function requireTools() {
    const missing = missingTools();
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

function printDeletionPlan(candidates, { intro, countLabel, dryRun = false }) {
    const prefix = dryRun ? '[DRY] ' : '';
    const lines = ['', `${prefix}${intro}`, ''];
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
    lines.push(`${prefix}${candidates.length} file(s) ${countLabel}.`);
    lines.push('');
    for (const line of lines) {
        if (line === '') console.log('');
        else console.log(line);
        appendLog(line);
    }
}

async function confirmDeletion(candidates, { flagLabel, intro, countLabel, firstPrompt, confirmedMessage }) {
    if (!input.isTTY || !output.isTTY) {
        console.error(`Error: ${flagLabel} requires an interactive terminal.`);
        process.exit(2);
    }

    printDeletionPlan(candidates, { intro, countLabel });

    const first = await promptLine(firstPrompt);
    if (!/^y(es)?$/i.test(first)) return false;

    const second = await promptLine('Type DELETE to confirm permanent deletion: ');
    if (second !== 'DELETE') return false;

    logConsole(confirmedMessage);
    return true;
}

function printDeletePlan(candidates, dryRun = false) {
    const intro = dryRun
        ? '--delete-originals: sources below would be converted and then PERMANENTLY DELETED.'
        : 'Conversion finished. Sources below were converted successfully and will be PERMANENTLY DELETED.';
    printDeletionPlan(candidates, {
        intro,
        countLabel: dryRun ? 'eligible for deletion after success' : 'ready to delete',
        dryRun,
    });
}

async function confirmDeleteOriginalsAfterConvert(candidates) {
    return confirmDeletion(candidates, {
        flagLabel: '--delete-originals',
        intro: 'Conversion finished. Sources below were converted successfully and will be PERMANENTLY DELETED.',
        countLabel: 'ready to delete',
        firstPrompt: 'Delete these originals now? [y/N]: ',
        confirmedMessage: 'Delete originals confirmed.',
    });
}

function buildCleanupCandidates(preflight) {
    const eligible = [];
    const skipped = [];

    for (const entry of preflight) {
        if (entry.status !== 'skip (exists)') {
            if (entry.status.startsWith('convert')) {
                skipped.push({ entry, reason: 'output does not exist yet' });
            }
            continue;
        }

        if (path.resolve(entry.input) === path.resolve(entry.out)) {
            skipped.push({ entry, reason: 'already the converted output' });
            continue;
        }

        const expectedType = entry.meta.mediaType === 'audio' ? 'audio' : 'video';
        const check = verifyOutput(entry.out, entry.meta.duration, expectedType);
        if (check.ok) {
            eligible.push(entry);
        } else {
            skipped.push({ entry, reason: check.reason });
        }
    }

    return { eligible, skipped };
}

async function runCleanupOriginals(preflight, dryRun) {
    const start = Date.now();
    logConsole('Verifying existing outputs before cleanup...');

    const { eligible, skipped } = buildCleanupCandidates(preflight);

    if (skipped.length > 0) {
        logConsole(`${skipped.length} file(s) not eligible for cleanup (no output or verification failed).`);
        for (const { entry, reason } of skipped) {
            logFile(`Cleanup skip: ${entry.input} (${reason})`);
            if (verbose) logConsole(`Cleanup skip: ${path.basename(entry.input)} (${reason})`);
        }
    }

    if (eligible.length === 0) {
        logConsole('No verified outputs found; --cleanup-originals has nothing to delete.');
        process.exit(0);
    }

    const intro = '--cleanup-originals: sources below will be PERMANENTLY DELETED because their output already exists and passed verification.\nOutputs are kept; only sources are removed.';

    if (dryRun) {
        printDeletionPlan(eligible, {
            intro: '--cleanup-originals: sources below will be PERMANENTLY DELETED because their output already exists and passed verification.\nOutputs are kept; only sources are removed.',
            countLabel: 'eligible for cleanup',
            dryRun: true,
        });
        logConsole(`=== Would delete ${eligible.length} original(s) (dry-run) ===`);
        process.exit(0);
    }

    const confirmed = await confirmDeletion(eligible, {
        flagLabel: '--cleanup-originals',
        intro,
        countLabel: 'eligible for cleanup',
        firstPrompt: 'Delete these originals now? [y/N]: ',
        confirmedMessage: 'Cleanup confirmed.',
    });

    if (!confirmed) {
        logConsole('Cleanup cancelled.');
        process.exit(0);
    }

    const { deleted, deleteFailed } = deleteOriginalFiles(eligible.map(e => e.input));
    const mins = ((Date.now() - start) / 1000 / 60).toFixed(1);
    logConsole(`=== Cleanup complete: ${deleted} deleted, ${deleteFailed} error(s), ${mins} minutes ===`);
    process.exit(deleteFailed > 0 ? 1 : 0);
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

function printPreflightTable(entries, dryRun) {
    const { lines } = buildPreflightTableLines(entries, dryRun);
    for (const line of lines) {
        if (line === '') console.log('');
        else console.log(line);
        appendLog(line);
    }
}

// --- discover inputs ---

let files = [];
const {
    target: arg, recursive, dryRun, force, outputDir, quality, deinterlace,
    verify, keepPartial, verbose, mediaMode, preferMtime, embedArt,
    deleteOriginals, cleanupOriginals, audioQuality, extractAudio,
} = cli;

const combinedMode = mediaMode.video && mediaMode.audio;
const audioOnlyMode = mediaMode.audio && !mediaMode.video;
const videoOnlyMode = mediaMode.video && !mediaMode.audio;

if (arg && fs.existsSync(arg) && !fs.statSync(arg).isDirectory()) {
    const resolved = path.resolve(arg);
    if (!hasMediaExt(resolved, mediaMode)) {
        const expected = combinedMode ? 'video or audio' : audioOnlyMode ? 'audio' : 'video';
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
    if (recursive) logFile(' (recursive mode)');
    files = await discoverFiles(target, recursive, mediaMode);
}

if (files.length === 0) {
    const hint = combinedMode ? 'video or audio files' : audioOnlyMode ? 'audio files' : 'video files';
    logConsole(`No ${hint} found. Try --recursive.`);
    process.exit(0);
}

let nvenc = false;
if (mediaMode.video && !cleanupOriginals) nvenc = detectNvenc();

logFile(`Log file: ${LOG_FILE}`);
if (MASTER_LOG_ENABLED) logFile(`Master log: ${MASTER_LOG_FILE}`);

const modeParts = cleanupOriginals
    ? ['cleanup-originals', 'verify']
    : combinedMode
        ? ['video+audio', quality]
        : audioOnlyMode
            ? ['audio', quality]
            : [`${nvenc ? 'NVENC' : 'CPU'}`, quality];
if (!cleanupOriginals && mediaMode.video) modeParts.push(deinterlace);
if (!cleanupOriginals && mediaMode.audio && preferMtime) modeParts.push('prefer-mtime');
if (!cleanupOriginals && mediaMode.audio && !embedArt) modeParts.push('no-embed-art');
if (extractAudio) modeParts.push('extract-audio');
if (audioQuality !== quality) modeParts.push(`audio:${audioQuality}`);
if (!cleanupOriginals && verify) modeParts.push('verify');
if (deleteOriginals) modeParts.push('delete-originals');
if (dryRun) modeParts.push('dry-run');
logConsole(`MediaTuna: ${files.length} files | ${modeParts.join(' | ')}`);

const preflight = await buildPreflightEntries(files, outputDir, force, mediaMode, {
    audioQuality,
    extractAudio,
    onProbeProgress: (i, total) => {
        if (total > 1) process.stderr.write(`\rProbing ${i}/${total}...`);
    },
});
if (files.length > 1) process.stderr.write('\r' + ' '.repeat(40) + '\r');
printPreflightTable(preflight, dryRun);

if (cleanupOriginals) {
    await runCleanupOriginals(preflight, dryRun);
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

function encodeWithFfmpeg(args, { activeFileBar, knownDuration } = {}) {
    return runFfmpeg(args, {
        setActiveProc: (proc) => { activeProc = proc; },
        onProgress: (chunk) => {
            if (!activeFileBar || !chunk.includes('time=')) return;
            const timeMatch = chunk.match(/time=([\d:.]+)/);
            if (!timeMatch) return;
            const current = timeToSeconds(timeMatch[1]);
            if (Number.isNaN(current)) return;
            if (!knownDuration && current > activeFileBar.getTotal()) {
                activeFileBar.setTotal(current + 60);
            }
            activeFileBar.update(current);
        },
    });
}

async function runEncodePass({
    input, out, meta, jobStatus, jobLabel, mode, lossyWarn, index, total,
}) {
    const base = path.basename(input);
    const passName = jobLabel ? `${base} [${jobLabel}]` : base;
    const isAudioJob = mode === 'audio' || mode === 'extract';

    if (jobStatus === 'skip (normalized)' || jobStatus === 'skip (exists)') {
        skipped++;
        logFile(`Skipped${jobStatus.includes('normalized') ? ' (normalized)' : ''}: ${passName}`);
        return true;
    }

    if (dryRun) {
        if (jobStatus.startsWith('convert')) {
            done++;
            if (verbose) {
                const suffix = mode === 'video'
                    ? ` (deinterlace: ${shouldDeinterlace(deinterlace, meta) ? 'yadif' : 'none'})`
                    : mode === 'extract' ? ' (extract)' : lossyWarn ? ' (lossy)' : '';
                fileLog(`Would convert: ${passName} → ${path.basename(out)}${suffix}`, index, total);
            }
        }
        return true;
    }

    if (lossyWarn) {
        const msg = `[WARN] ${passName} → ${path.basename(out)} (lossy; source cannot be recovered from MP3)`;
        logFile(msg);
        if (verbose) logConsole(msg);
    }

    if (meta.duration <= 0) {
        logFile(`[WARN] ${passName}: zero duration reported; progress may be approximate`);
    }

    if (!fs.existsSync(path.dirname(out))) fs.mkdirSync(path.dirname(out), { recursive: true });

    const knownDuration = meta.duration > 0;
    const barTotal = knownDuration ? Math.floor(meta.duration) : 3600;
    const activeFileBar = fileBar ??= multibar.create(barTotal, 0, {
        filename: passName,
    }, {
        format: 'Current [{bar}] {percentage}% | {value} / {total} | ETA {eta_formatted} | {filename}',
        formatValue: formatHMSValue,
        formatTime: formatTimeHMS,
    });
    activeFileBar.start(barTotal, 0, { filename: passName });

    const args = mode === 'video'
        ? buildFfmpegArgs(input, out, meta, { quality, nvenc, deinterlaceMode: deinterlace })
        : mode === 'extract'
            ? buildExtractAudioFfmpegArgs(input, out, { audioQuality, preferMtime, meta })
            : buildAudioFfmpegArgs(input, out, { audioQuality, embedArt, preferMtime, meta });

    logFile(`--- ${passName} ---`);
    if (mode === 'video') {
        const deinterlaceApplied = shouldDeinterlace(deinterlace, meta);
        logFile(`Deinterlace: ${deinterlaceApplied ? 'yadif' : 'off'} (mode=${deinterlace}, field_order=${meta.field_order})`);
    } else {
        const artNote = embedArt ? (meta.hasCoverArt ? 'embed cover' : 'embed cover if present') : 'no cover';
        const dateNote = preferMtime && !hasDateTag(meta.tags) ? `date=${formatMtimeDate(input)} from mtime` : 'tags as-is';
        logFile(`Encode: libmp3lame -q:a ${lameQuality(audioQuality)} | ${artNote} | ${dateNote}${mode === 'extract' ? ' | extract from video' : ''}`);
    }
    logFile(`Command: ffmpeg ${args.map(shellQuote).join(' ')}`);

    const encodeStart = Date.now();
    const expectedType = mode === 'video' ? 'video' : 'audio';
    try {
        await encodeWithFfmpeg(args, { activeFileBar, knownDuration });
        const elapsedSec = (Date.now() - encodeStart) / 1000;
        const elapsedStr = elapsedSec >= 60
            ? `${Math.floor(elapsedSec / 60)}m ${Math.round(elapsedSec % 60)}s`
            : `${elapsedSec.toFixed(1)}s`;

        if (verify) {
            const verifyContext = isAudioJob ? { sourceMeta: meta, sourceSize: meta.size } : null;
            const check = verifyOutput(out, meta.duration, expectedType, verifyContext);
            if (!check.ok) throw new Error(`verification failed: ${check.reason}`);
            for (const warning of check.warnings ?? []) {
                logFile(`[WARN] ${passName}: ${warning}`);
                if (verbose) logConsole(`[WARN] ${passName}: ${warning}`);
            }
            try {
                applyOutputTimestamps(input, out);
            } catch { }
            const outBase = path.basename(out);
            const detail = `✓ ${outBase} | Verified (${secondsToHMS(check.duration)}) | Metadata copied`;
            logFile(`${detail} | --- end ${passName} (${elapsedStr}) ---`);
            logToConsole(verbose ? detail : `✓ ${outBase}`);
        } else {
            try {
                applyOutputTimestamps(input, out);
            } catch { }
            const outBase = path.basename(out);
            logFile(`✓ ${outBase} | --- end ${passName} (${elapsedStr}) ---`);
            logToConsole(verbose ? `✓ ${outBase}` : `✓ ${outBase}`);
        }

        done++;
        activeFileBar.update(knownDuration ? Math.floor(meta.duration) : activeFileBar.value);
        return true;
    } catch (err) {
        const elapsedSec = (Date.now() - encodeStart) / 1000;
        logConsole(`Error: ${passName} - ${err.message}`);
        logFile(`--- end ${passName} (${elapsedSec.toFixed(1)}s, failed) ---`);
        removePartialOutput(out, keepPartial, (msg) => logFile(msg));
        failed++;
        if (!failedPaths.includes(input)) failedPaths.push(input);
        return false;
    }
}

async function processFile(entry, index) {
    if (shuttingDown) return;

    const { input, out, audioOut, meta, videoStatus, extractStatus, lossy } = entry;
    const total = preflight.length;
    const base = path.basename(input);

    logFile(`Processing: ${base} | Type: ${meta.mediaType} | Duration: ${secondsToHMS(meta.duration)} | Created: ${meta.creation_time} | Updated: ${meta.modified_time}`);

    if (videoStatus === 'unreadable') {
        failed++;
        failedPaths.push(input);
        logConsole(`Unreadable: ${base}`);
        if (overallBar) overallBar.increment();
        return;
    }

    if (videoStatus === 'skip (wrong type)' && !extractStatus) {
        skipped++;
        logFile(`Skipped (wrong type): ${base}`);
        if (overallBar) overallBar.increment();
        return;
    }

    if (dryRun) {
        if (isSkippableStatus(videoStatus)) skipped++;
        else if (videoStatus.startsWith('convert')) done++;
        if (extractStatus) {
            if (isSkippableStatus(extractStatus)) skipped++;
            else if (extractStatus.startsWith('convert')) done++;
        }
        if (verbose && (videoStatus.startsWith('convert') || extractStatus?.startsWith('convert'))) {
            fileLog(`Would process: ${base} (${entry.status})`, index, total);
        }
        if (overallBar) overallBar.increment();
        return;
    }

    let primaryConverted = false;
    const jobs = [];

    if (meta.mediaType === 'video' && mediaMode.video && videoStatus !== 'skip (wrong type)') {
        jobs.push({ out, jobStatus: videoStatus, jobLabel: null, mode: 'video', lossyWarn: false });
    } else if (meta.mediaType === 'audio' && mediaMode.audio) {
        jobs.push({ out, jobStatus: videoStatus, jobLabel: null, mode: 'audio', lossyWarn: lossy });
    }
    if (extractStatus && extractAudio && audioOut) {
        jobs.push({ out: audioOut, jobStatus: extractStatus, jobLabel: 'extract', mode: 'extract', lossyWarn: false });
    }

    for (const job of jobs) {
        const ok = await runEncodePass({ input, meta, index, total, ...job });
        if (ok && job.jobStatus.startsWith('convert') && job.mode !== 'extract') {
            primaryConverted = true;
        }
    }

    if (primaryConverted) convertedInputs.push(input);
    if (overallBar) overallBar.increment();
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
logConsole(`=== MediaTuna Complete${dryLabel}: ${done} ${doneLabel}, ${skipped} skipped, ${failed} failed, ${mins} minutes ===`);

let deleteFailed = 0;
if (deleteOriginals) {
    const deleteCandidates = dryRun
        ? preflight.filter(e =>
            isConvertStatus(e.videoStatus) || (e.extractStatus && isConvertStatus(e.extractStatus)))
        : preflight.filter(e => convertedInputs.includes(e.input));

    if (deleteCandidates.length === 0) {
        logConsole('No files converted successfully; --delete-originals has nothing to delete.');
    } else if (dryRun) {
        printDeletePlan(deleteCandidates, true);
        logConsole(`=== Would delete up to ${deleteCandidates.length} original(s) after successful conversion (dry-run) ===`);
    } else {
        const confirmed = await confirmDeleteOriginalsAfterConvert(deleteCandidates);
        if (confirmed) {
            const { deleted, deleteFailed: delFail } = deleteOriginalFiles(convertedInputs);
            deleteFailed = delFail;
            logConsole(`=== Deleted ${deleted} original(s), ${delFail} delete error(s) ===`);
        } else {
            logConsole('Delete originals cancelled.');
        }
    }
}

process.exit(failed > 0 || deleteFailed > 0 ? 1 : 0);

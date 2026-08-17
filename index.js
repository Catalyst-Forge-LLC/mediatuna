#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';
import { stdin as input, stdout as output } from 'process';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { buildCliConfig, CLI_PARSE_OPTIONS, CliConfigError } from './lib/cli-config.js';
import {
    buildCleanupCandidates,
    deleteOriginalFiles,
    formatDeletionPlanLines,
} from './lib/cleanup.js';
import { detectNvenc } from './lib/encode.js';
import { resolveEffectiveJobs } from './lib/jobs.js';
import { createLogger, ensureLogDir } from './lib/log.js';
import { buildPreflightEntries, buildPreflightTableLines } from './lib/preflight.js';
import {
    buildModeParts,
    loadInputFiles,
    mediaModeHint,
    resolveInputFiles,
    warnUnknownExtension,
} from './lib/resolve-inputs.js';
import { runConversion } from './lib/run.js';
import {
    applyResumeToPreflight,
    buildRunKey,
    createResumeState,
    defaultStatePath,
    loadResumeState,
    markCompleted,
    saveResumeState,
} from './lib/resume-state.js';
import { runDupeReport } from './lib/dupe-report.js';
import { parseExtList, runRecupMap } from './lib/recup-map.js';
import { runStampDates } from './lib/stamp-dates.js';
import { isConvertStatus } from './lib/status.js';
import { requireTools as missingTools } from './lib/tools.js';
import { getMetadata } from './lib/probe.js';
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
  --resume             Skip files completed in a prior run (uses .mediatuna-state.json)
  --jobs <N>           Encode up to N files in parallel (default: 1; NVENC: try 3–4)
  --verbose            Show per-file details on console (default: quiet)
  --prefer-mtime       Use file mtime when tags have no date (MP3 tag, or MTIME_ filename stamp)
  --embed-art          Embed album cover in MP3 when present (default)
  --no-embed-art       Skip embedding album cover in MP3
  --stamp-dates        Rename sources: metadata date, or normalize to YYYY-MM-DD_HH-MM-SS
  --no-stamp-dates     Do not prefix video MP4 names with creation date
  --backup <folder>    With --stamp-dates: copy originals here before renaming
  --dupe-report        Ask Everything where else each file exists (name+size, then size-only)
  --hash               With --dupe-report: confirm size-only hits with SHA-256
  --recup-map          Map a PhotoRec-style dump to folders using copies found elsewhere
  --ext <list>         With --recup-map: extensions (default: audio + phone video)
  --apply              With --recup-map: copy placed files into proposed-tree/

Video formats: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG, WMV, 3GP, 3G2 → MP4
Audio formats: MP3, FLAC, WAV, AIFF, M4A, AAC, OGG, Opus, WMA, AC3, DTS, AMR, QCP → MP3

Requires ffmpeg and ffprobe on PATH. --dupe-report and --recup-map need Everything (es.exe) running.

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

function requireFfmpeg() {
    const missing = missingTools();
    if (missing.length > 0) {
        console.error(`Error: required tools not found on PATH: ${missing.join(', ')}`);
        console.error('Install ffmpeg (includes ffprobe) and ensure it is on PATH.');
        process.exit(2);
    }
}

const cli = parseCli();
if (!cli.dupeReport && !cli.recupMap) requireFfmpeg();

const {
    target: arg, recursive, dryRun, force, outputDir, quality, deinterlace,
    verify, keepPartial, verbose, mediaMode, preferMtime, embedArt,
    deleteOriginals, cleanupOriginals, audioQuality, extractAudio, resume, jobs: requestedJobs,
    stampDates, stampVideo, backupDir, dupeReport, dupeHash, recupMap, recupExt, recupApply,
} = cli;

const LOG_FILE = cli.logFile;
const MASTER_LOG_FILE = cli.masterLogFile;
const MASTER_LOG_ENABLED = cli.masterLogEnabled;
const STATE_PATH = defaultStatePath(LOG_FILE);
const runKey = buildRunKey({ outputDir, quality, audioQuality, deinterlace, mediaMode, extractAudio, verify, stampVideo });
let resumeState = createResumeState(runKey);
const FAILED_REPORT = path.join(path.dirname(LOG_FILE), 'mediatuna-failed.txt');

ensureLogDir(LOG_FILE);
if (MASTER_LOG_ENABLED) ensureLogDir(MASTER_LOG_FILE);

let multibar = null;
const activeProcs = new Set();
let shuttingDown = false;

const logger = createLogger({
    logFile: LOG_FILE,
    masterLogFile: MASTER_LOG_FILE,
    masterLogEnabled: MASTER_LOG_ENABLED,
    verbose,
    getMultibar: () => multibar,
});

const { logFile, logConsole, logVerbose } = logger;

async function promptLine(question) {
    const rl = readline.createInterface({ input, output });
    try {
        return (await rl.question(question)).trim();
    } finally {
        rl.close();
    }
}

function printDeletionPlan(candidates, opts) {
    logger.printLines(formatDeletionPlanLines(candidates, opts));
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

function printDeletePlan(candidates, dryRunFlag = false) {
    const intro = dryRunFlag
        ? '--delete-originals: sources below would be converted and then PERMANENTLY DELETED.'
        : 'Conversion finished. Sources below were converted successfully and will be PERMANENTLY DELETED.';
    printDeletionPlan(candidates, {
        intro,
        countLabel: dryRunFlag ? 'eligible for deletion after success' : 'ready to delete',
        dryRun: dryRunFlag,
    });
}

async function runCleanupOriginals(preflight, dryRunFlag) {
    const start = Date.now();
    logConsole('Verifying existing outputs before cleanup...');

    const { eligible, skipped } = buildCleanupCandidates(preflight, verifyOutput);

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

    if (dryRunFlag) {
        printDeletionPlan(eligible, { intro, countLabel: 'eligible for cleanup', dryRun: true });
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

    const { deleted, deleteFailed } = deleteOriginalFiles(eligible.map(e => e.input), logConsole);
    const mins = ((Date.now() - start) / 1000 / 60).toFixed(1);
    logConsole(`=== Cleanup complete: ${deleted} deleted, ${deleteFailed} error(s), ${mins} minutes ===`);
    process.exit(deleteFailed > 0 ? 1 : 0);
}

function cleanupProgress() {
    if (multibar?.isActive) multibar.stop();
}

process.on('SIGINT', () => {
    if (shuttingDown) process.exit(130);
    shuttingDown = true;
    console.error('\nInterrupted.');
    for (const proc of activeProcs) proc.kill('SIGTERM');
    cleanupProgress();
    process.exit(130);
});

function printPreflightTable(entries, dryRunFlag) {
    const { lines } = buildPreflightTableLines(entries, dryRunFlag);
    logger.printLines(lines);
}

const resolved = resolveInputFiles({ target: arg, recursive, mediaMode });
if (resolved.error) {
    console.error(`Error: ${resolved.error}`);
    process.exit(2);
}

if (recupMap) {
    const rootDir = resolved.mode === 'folder' ? resolved.targetPath : path.dirname(resolved.files[0]);
    const extSet = parseExtList(recupExt);
    const startRecup = Date.now();
    logConsole(`MediaTuna: recup-map | ${[...extSet].sort().join(',')}${recupApply ? ' | apply' : ''}${dryRun ? ' | dry-run' : ''}`);
    try {
        const { stats, reportPath, treeDir } = await runRecupMap({
            rootDir,
            extSet,
            dryRun,
            apply: recupApply,
            onProgress: (i, total) => {
                if (i === 1 || i === total || i % 100 === 0) {
                    logConsole(`  mapped ${i}/${total}`);
                }
            },
        });
        if (reportPath) logConsole(`Recup map: ${reportPath}`);
        if (treeDir) logConsole(`Proposed tree: ${treeDir}`);
        const mins = ((Date.now() - startRecup) / 1000 / 60).toFixed(1);
        logConsole(`=== Recup map complete: ${stats.placed} placed, ${stats.ambiguous} ambiguous, ${stats.unmatched} unmatched, ${stats.copied ?? 0} copied, ${stats.errors} errors, ${mins} minutes ===`);
        process.exit(stats.errors > 0 ? 1 : 0);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
    }
}

let files = resolved.files ?? await loadInputFiles(resolved, mediaMode, { stampDates: stampDates || dupeReport });

const extWarn = warnUnknownExtension({ ...resolved, files }, mediaMode, { stampDates: stampDates || dupeReport });
if (extWarn) {
    logConsole(`Warning: ${extWarn.file} is not a known ${extWarn.expected} extension; attempting anyway.`);
}
if (resolved.mode === 'single') {
    logFile(`Single file mode: ${path.basename(resolved.files[0])}`);
} else {
    logFile(`Scanning folder: ${resolved.targetPath}`);
    if (recursive) logFile(' (recursive mode)');
}

if (files.length === 0) {
    logConsole(`No ${mediaModeHint(resolved)} found. Try --recursive.`);
    process.exit(0);
}

if (dupeReport) {
    const startDupe = Date.now();
    logConsole(`MediaTuna: ${files.length} files | dupe-report${dupeHash ? ' | hash' : ''}${dryRun ? ' | dry-run' : ''}`);
    try {
        const { lines, stats, reportPath } = await runDupeReport({
            files,
            rootDir: resolved.mode === 'folder' ? resolved.targetPath : path.dirname(files[0]),
            hash: dupeHash,
            dryRun,
        });
        logger.printLines(lines);
        if (reportPath) logConsole(`Dupe report: ${reportPath}`);
        const mins = ((Date.now() - startDupe) / 1000 / 60).toFixed(1);
        logConsole(`=== Dupe report complete: ${stats.nameCopies} name+size, ${stats.sizeOnly} size-only, ${stats.unique} unique, ${stats.errors} errors, ${mins} minutes ===`);
        process.exit(stats.errors > 0 ? 1 : 0);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
    }
}

if (stampDates) {
    const startStamp = Date.now();
    const stampMode = ['stamp-dates'];
    if (preferMtime) stampMode.push('prefer-mtime');
    if (dryRun) stampMode.push('dry-run');
    logConsole(`MediaTuna: ${files.length} files | ${stampMode.join(' | ')}`);
    if (backupDir) logConsole(`Backup folder: ${backupDir}`);

    const { result } = runStampDates({
        files,
        probeFn: getMetadata,
        preferMtime,
        dryRun,
        backupDir,
        rootDir: resolved.mode === 'folder' ? resolved.targetPath : path.dirname(files[0]),
        logger,
    });

    const mins = ((Date.now() - startStamp) / 1000 / 60).toFixed(1);
    const dryLabel = dryRun ? ' (dry-run)' : '';
    const doneLabel = dryRun ? 'would rename' : 'renamed';
    logConsole(`=== Stamp dates complete${dryLabel}: ${result.renamed} ${doneLabel}, ${result.skipped} skipped, ${result.failed} failed, ${mins} minutes ===`);
    process.exit(result.failed > 0 ? 1 : 0);
}

const nvenc = mediaMode.video && !cleanupOriginals ? detectNvenc() : false;
const jobs = resolveEffectiveJobs(requestedJobs, { nvenc, mediaMode });

logFile(`Log file: ${LOG_FILE}`);
if (MASTER_LOG_ENABLED) logFile(`Master log: ${MASTER_LOG_FILE}`);
if (jobs > 1 && !dryRun && !cleanupOriginals) {
    logConsole(`Parallel: ${jobs} concurrent file encode(s)${nvenc ? ' (NVENC)' : ' (CPU)'}.`);
    if (nvenc && requestedJobs > jobs) {
        logFile(`Note: --jobs ${requestedJobs} capped to ${jobs} for CPU encode path.`);
    }
}

const modeParts = buildModeParts({
    cleanupOriginals, stampVideo, combinedMode: resolved.combinedMode, audioOnlyMode: resolved.audioOnlyMode,
    nvenc, quality, deinterlace, mediaMode, preferMtime, embedArt, extractAudio, audioQuality,
    verify, deleteOriginals, dryRun, resume, jobs,
});
logConsole(`MediaTuna: ${files.length} files | ${modeParts.join(' | ')}`);

let preflight = await buildPreflightEntries(files, outputDir, force, mediaMode, {
    audioQuality,
    extractAudio,
    stampVideo,
    preferMtime,
    onProbeProgress: (i, total) => {
        if (total > 1) process.stderr.write(`\rProbing ${i}/${total}...`);
    },
});
if (files.length > 1) process.stderr.write('\r' + ' '.repeat(40) + '\r');

if (resume) {
    const loaded = loadResumeState(STATE_PATH);
    if (!loaded) {
        logConsole('Resume: no saved state found; converting all files.');
    } else if (loaded.runKey !== runKey) {
        logConsole('Resume: saved state does not match current options; ignoring prior progress.');
    } else {
        resumeState = loaded;
        const applied = applyResumeToPreflight(preflight, resumeState, {
            resume: true,
            force,
            mediaMode,
            extractAudio,
            verifyOutputFn: verifyOutput,
        });
        preflight = applied.entries;
        if (applied.resumed > 0) {
            logConsole(`Resume: skipping ${applied.resumed} file(s) already completed (state: ${STATE_PATH}).`);
        }
    }
} else if (!dryRun && !cleanupOriginals) {
    logFile(`Resume state: ${STATE_PATH}`);
}

printPreflightTable(preflight, dryRun);

if (cleanupOriginals) {
    await runCleanupOriginals(preflight, dryRun);
}

multibar = dryRun ? null : new cliProgress.MultiBar({
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: false,
    forceRedraw: true,
});

const overallBar = !dryRun && files.length > 1
    ? multibar.create(files.length, 0, {}, {
        format: 'Overall [{bar}] {percentage}% | {value}/{total} files',
        clearOnComplete: false,
    })
    : null;

const start = Date.now();
let resumeSaveChain = Promise.resolve();

const { stats, failedPaths, convertedInputs } = await runConversion({
    preflight,
    config: {
        dryRun, verify, keepPartial, quality, audioQuality, deinterlace, nvenc,
        preferMtime, embedArt, extractAudio, mediaMode, verbose, jobs,
    },
    logger,
    progress: {
        overallBar,
        registerProc(proc) {
            if (proc) activeProcs.add(proc);
        },
        unregisterProc(proc) {
            if (proc) activeProcs.delete(proc);
        },
        isShuttingDown: () => shuttingDown,
        createFileBar: (barTotal, passName, barOptions) =>
            multibar.create(barTotal, 0, { filename: passName }, {
                clearOnComplete: true,
                stopOnComplete: true,
                ...barOptions,
            }),
    },
    resumeState: !dryRun && !cleanupOriginals
        ? {
            markCompleted(input) {
                markCompleted(resumeState, input);
                resumeSaveChain = resumeSaveChain.then(() => {
                    saveResumeState(STATE_PATH, resumeState);
                });
            },
        }
        : null,
});

await resumeSaveChain;

cleanupProgress();

if (failedPaths.length > 0) {
    fs.writeFileSync(FAILED_REPORT, failedPaths.map(p => path.resolve(p)).join('\n') + '\n');
    logConsole(`Failed files list: ${FAILED_REPORT}`);
}

const mins = ((Date.now() - start) / 1000 / 60).toFixed(1);
const dryLabel = dryRun ? ' (dry-run)' : '';
const doneLabel = dryRun ? 'would convert' : 'converted';
const resumedNote = stats.resumed > 0 ? `, ${stats.resumed} resumed` : '';
logConsole(`=== MediaTuna Complete${dryLabel}: ${stats.done} ${doneLabel}, ${stats.skipped} skipped${resumedNote}, ${stats.failed} failed, ${mins} minutes ===`);

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
        const confirmed = await confirmDeletion(deleteCandidates, {
            flagLabel: '--delete-originals',
            intro: 'Conversion finished. Sources below were converted successfully and will be PERMANENTLY DELETED.',
            countLabel: 'ready to delete',
            firstPrompt: 'Delete these originals now? [y/N]: ',
            confirmedMessage: 'Delete originals confirmed.',
        });
        if (confirmed) {
            const { deleted, deleteFailed: delFail } = deleteOriginalFiles(convertedInputs, logConsole);
            deleteFailed = delFail;
            logConsole(`=== Deleted ${deleted} original(s), ${delFail} delete error(s) ===`);
        } else {
            logConsole('Delete originals cancelled.');
        }
    }
}

process.exit(stats.failed > 0 || deleteFailed > 0 ? 1 : 0);

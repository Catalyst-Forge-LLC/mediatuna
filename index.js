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
    formatUnknownExtensionError,
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
import { archiveDestPath, formatArchivePlanLines, moveOriginalsToArchive } from './lib/archive.js';
import { collectRecupCleanup, discoverRecupFiles, parseExtList, runRecupMap } from './lib/recup-map.js';
import { runStampDates } from './lib/stamp-dates.js';
import { isConvertStatus } from './lib/status.js';
import { requireTools as missingTools } from './lib/tools.js';
import { getMetadata } from './lib/probe.js';
import { verifyOutput } from './lib/verify.js';
import {
    LARGE_BATCH_THRESHOLD,
    STAMP_BACKUP_WARN_THRESHOLD,
    LOSSY_BANNER,
    checkFreeSpace,
    countOverwriteTargets,
    estimateNeededBytes,
    formatDiskSpaceError,
    formatForceOverwritePrompt,
    formatLargeBatchPrompt,
    formatStampBackupWarn,
    formatWriteLocationBanner,
    shouldShowLossyBanner,
} from './lib/safety.js';

const HELP = `MediaTuna — batch-convert a home media archive to MP4 and MP3
(keeps dates, tags, and already-finished work)

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
  --output <folder>    Write outputs here, keeping source subfolders
  --include <glob>     Only files matching this glob (repeatable; basename or relative path)
  --exclude <glob>     Skip files matching this glob (repeatable)
  --archive <folder>   After verify: move sources here (safer than delete)
  --sample <seconds>   Encode only the first N seconds to *.sample.mp4 / *.sample.mp3
  --log <file>         Append log to this file (default: ./mediatuna-log.txt)
  --no-master-log      Do not mirror log to ~/.mediatuna/history.log
  --master-log <file>  Custom master log path (still mirrors run log)
  --delete-originals   After conversion: trash sources that converted successfully (interactive)
  --cleanup-originals  Trash sources whose outputs already exist (convert, or recup-map after --apply)
  --delete-permanent   With delete/cleanup: unlink instead of Recycle Bin / trash (type DELETE)
  --yes                Skip large-batch, --force overwrite, disk-space, and stamp-backup prompts
  --quality <preset>   high | medium | fast (default: medium; video + default audio)
  --audio-quality <preset>  Audio LAME preset (default: same as --quality)
  --reencode-audio     Always re-encode video audio to AAC 192k (default: copy when source is AAC LC)
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
  --hash               With --dupe-report: confirm size-only hits. With --recup-map --apply: copy only SHA-256 matches
  --recup-map          Map a PhotoRec-style dump to folders using copies found elsewhere
  --ext <list>         With --recup-map: extensions (default: audio + phone video)
  --apply              With --recup-map: copy placed files into proposed-tree/

Video formats: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG, WMV, 3GP, 3G2 → MP4
Audio formats: MP3, FLAC, WAV, AIFF, M4A, AAC, OGG, Opus, WMA, AC3, DTS, AMR, QCP → MP3

Requires ffmpeg and ffprobe on PATH. --dupe-report and --recup-map need Everything (es.exe) running.

First archive: --dry-run, then --output to a separate folder. Try --sample 20 before a full run. Deletes go to Recycle Bin unless --delete-permanent. --archive moves sources after verify.
Size/name matches are not byte-identical. --hash is SHA-256 of the whole file. Convert --verify is duration only.

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
    yes, deletePermanent, include, exclude, archiveDir, sampleSeconds, reencodeAudio,
} = cli;

const LOG_FILE = cli.logFile;
const MASTER_LOG_FILE = cli.masterLogFile;
const MASTER_LOG_ENABLED = cli.masterLogEnabled;
const STATE_PATH = defaultStatePath(LOG_FILE);
const runKey = buildRunKey({
    outputDir, quality, audioQuality, deinterlace, mediaMode, extractAudio, verify, stampVideo, reencodeAudio,
});
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

function isTty() {
    return Boolean(input.isTTY && output.isTTY);
}

function deleteFate() {
    return deletePermanent
        ? 'PERMANENTLY DELETED (not sent to Recycle Bin / trash)'
        : 'moved to the Recycle Bin / trash';
}

async function confirmContinue(promptText, { flagLabel, allowEnter = false } = {}) {
    if (yes) return true;
    if (!isTty()) {
        console.error(`Error: ${flagLabel} requires an interactive terminal or --yes.`);
        process.exit(2);
    }
    const line = await promptLine(promptText);
    if (allowEnter && line === '') return true;
    return /^y(es)?$/i.test(line);
}

async function confirmDeletion(candidates, { flagLabel, intro, countLabel, firstPrompt, confirmedMessage }) {
    if (!isTty()) {
        console.error(`Error: ${flagLabel} requires an interactive terminal.`);
        process.exit(2);
    }

    printDeletionPlan(candidates, { intro, countLabel });

    const first = await promptLine(firstPrompt);
    if (!/^y(es)?$/i.test(first)) return false;

    if (deletePermanent) {
        const second = await promptLine('Type DELETE to confirm permanent deletion: ');
        if (second !== 'DELETE') return false;
    }

    logConsole(confirmedMessage);
    return true;
}

function printDeletePlan(candidates, dryRunFlag = false) {
    const intro = dryRunFlag
        ? `--delete-originals: sources below would be converted and then ${deleteFate()}.`
        : `Conversion finished. Sources below were converted successfully and will be ${deleteFate()}.`;
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

    if (archiveDir) {
        const archiveCandidates = eligible.map(entry => ({
            input: entry.input,
            dest: archiveDestPath(entry.input, archiveDir, { rootDir: resolveSourceRoot() }),
        }));
        if (dryRunFlag) {
            logger.printLines(formatArchivePlanLines(archiveCandidates, { archiveDir, dryRun: true }));
            logConsole(`=== Would archive ${eligible.length} original(s) (dry-run) ===`);
            process.exit(0);
        }
        const confirmed = await confirmDeletion(eligible, {
            flagLabel: '--archive',
            intro: `--cleanup-originals --archive: sources below will be moved to ${archiveDir} because their output already exists and passed duration verification.`,
            countLabel: 'ready to archive',
            firstPrompt: 'Move these originals to the archive folder now? [y/N]: ',
            confirmedMessage: 'Archive confirmed.',
        });
        if (!confirmed) {
            logConsole('Archive cancelled.');
            process.exit(0);
        }
        const { moved, failed } = moveOriginalsToArchive(eligible.map(e => e.input), archiveDir, {
            rootDir: resolveSourceRoot(),
            logConsole,
        });
        const mins = ((Date.now() - start) / 1000 / 60).toFixed(1);
        logConsole(`=== Cleanup archive complete: ${moved} moved, ${failed} error(s), ${mins} minutes ===`);
        process.exit(failed > 0 ? 1 : 0);
    }

    const intro = `--cleanup-originals: sources below will be ${deleteFate()} because their output already exists and passed duration verification.\nOutputs are kept; only sources are removed.`;

    if (dryRunFlag) {
        printDeletionPlan(eligible, { intro, countLabel: 'eligible for cleanup', dryRun: true });
        logConsole(`=== Would delete ${eligible.length} original(s) (dry-run) ===`);
        process.exit(0);
    }

    const confirmed = await confirmDeletion(eligible, {
        flagLabel: '--cleanup-originals',
        intro,
        countLabel: 'eligible for cleanup',
        firstPrompt: deletePermanent ? 'Delete these originals now? [y/N]: ' : 'Move these originals to trash now? [y/N]: ',
        confirmedMessage: 'Cleanup confirmed.',
    });

    if (!confirmed) {
        logConsole('Cleanup cancelled.');
        process.exit(0);
    }

    const { deleted, deleteFailed } = await deleteOriginalFiles(eligible.map(e => e.input), logConsole, {
        permanent: deletePermanent,
    });
    const mins = ((Date.now() - start) / 1000 / 60).toFixed(1);
    logConsole(`=== Cleanup complete: ${deleted} deleted, ${deleteFailed} error(s), ${mins} minutes ===`);
    process.exit(deleteFailed > 0 ? 1 : 0);
}

function resolveSourceRoot() {
    if (resolved.mode === 'folder') return resolved.targetPath;
    return path.dirname(resolved.files[0]);
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
    logConsole(`MediaTuna: recup-map | ${[...extSet].sort().join(',')}${recupApply ? ' | apply' : ''}${dupeHash ? ' | hash' : ''}${cleanupOriginals ? ' | cleanup-originals' : ''}${dryRun ? ' | dry-run' : ''}`);
    const recupFiles = discoverRecupFiles(rootDir, extSet);
    if ((recupApply || cleanupOriginals) && recupFiles.length > LARGE_BATCH_THRESHOLD && !dryRun) {
        logConsole(`Large batch: ${recupFiles.length} recup files under ${rootDir}.`);
        if (!await confirmContinue(formatLargeBatchPrompt({ count: recupFiles.length, root: rootDir }), {
            flagLabel: 'large batch',
            allowEnter: true,
        })) {
            logConsole('Cancelled.');
            process.exit(0);
        }
    }
    try {
        const { stats, reportPath, treeDir, rows } = await runRecupMap({
            rootDir,
            extSet,
            dryRun,
            apply: recupApply,
            hash: dupeHash,
            onProgress: (i, total) => {
                if (i === 1 || i === total || i % 100 === 0) {
                    logConsole(`  mapped ${i}/${total}`);
                }
            },
        });
        if (reportPath) logConsole(`Recup map: ${reportPath}`);
        if (treeDir) logConsole(`Proposed tree: ${treeDir}`);
        let deleted = 0;
        let deleteFailed = 0;
        if (cleanupOriginals) {
            const cleanupTree = treeDir ?? path.join(rootDir, 'proposed-tree');
            const eligible = await collectRecupCleanup(rows, cleanupTree, { rootDir });
            const intro = `--cleanup-originals: recup sources below will be ${deleteFate()} because a SHA-256 match already exists in proposed-tree/.\nSize-only is not enough. The tree and gold copies are kept; only recup_dir files are removed.`;
            if (eligible.length === 0) {
                logConsole('No placed recup files have a SHA-256 match in proposed-tree; nothing to delete.');
            } else if (dryRun) {
                printDeletionPlan(eligible, { intro, countLabel: 'eligible for cleanup', dryRun: true });
                logConsole(`=== Would delete ${eligible.length} recup original(s) (dry-run) ===`);
            } else {
                const confirmed = await confirmDeletion(eligible, {
                    flagLabel: '--cleanup-originals',
                    intro,
                    countLabel: 'eligible for cleanup',
                    firstPrompt: deletePermanent ? 'Delete these recup originals now? [y/N]: ' : 'Move these recup originals to trash now? [y/N]: ',
                    confirmedMessage: 'Cleanup confirmed.',
                });
                if (!confirmed) {
                    logConsole('Cleanup cancelled.');
                } else {
                    ({ deleted, deleteFailed } = await deleteOriginalFiles(eligible.map(e => e.input), logConsole, {
                        permanent: deletePermanent,
                    }));
                }
            }
        }
        const mins = ((Date.now() - startRecup) / 1000 / 60).toFixed(1);
        const deleteNote = cleanupOriginals ? `, ${deleted} deleted, ${deleteFailed} delete-failed` : '';
        logConsole(`=== Recup map complete: ${stats.placed} placed, ${stats.ambiguous} ambiguous, ${stats.unmatched} unmatched, ${stats.copied ?? 0} copied, ${stats.skipped ?? 0} skipped${deleteNote}, ${stats.errors} errors, ${mins} minutes ===`);
        process.exit(stats.errors > 0 || deleteFailed > 0 ? 1 : 0);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
    }
}

let files = await loadInputFiles(resolved, mediaMode, {
    stampDates: stampDates || dupeReport,
    include,
    exclude,
});

const extWarn = warnUnknownExtension({ ...resolved, files }, mediaMode, { stampDates: stampDates || dupeReport });
if (extWarn) {
    console.error(`Error: ${formatUnknownExtensionError(extWarn)}`);
    process.exit(2);
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

const readOnlyHelper = dupeReport || (recupMap && !recupApply && !cleanupOriginals);
if (!readOnlyHelper && files.length > LARGE_BATCH_THRESHOLD) {
    const root = resolved.mode === 'folder' ? resolved.targetPath : path.dirname(files[0]);
    logConsole(`Large batch: ${files.length} files under ${root}.`);
    if (!dryRun && !await confirmContinue(formatLargeBatchPrompt({ count: files.length, root }), {
        flagLabel: 'large batch',
        allowEnter: true,
    })) {
        logConsole('Cancelled.');
        process.exit(0);
    }
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
    if (backupDir) {
        logConsole(`Backup folder: ${backupDir}`);
    } else if (!dryRun && files.length > STAMP_BACKUP_WARN_THRESHOLD) {
        if (!await confirmContinue(formatStampBackupWarn(files.length), {
            flagLabel: '--stamp-dates',
            allowEnter: true,
        })) {
            logConsole('Cancelled.');
            process.exit(0);
        }
    }

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
    verify, deleteOriginals, deletePermanent, dryRun, resume, jobs,
    archiveDir, sampleSeconds, reencodeAudio,
});
logConsole(`MediaTuna: ${files.length} files | ${modeParts.join(' | ')}`);
const sourceDir = resolved.mode === 'folder' ? resolved.targetPath : path.dirname(files[0]);
logConsole(formatWriteLocationBanner({
    count: files.length,
    outputDir,
    sourceDir,
}));

let preflight = await buildPreflightEntries(files, outputDir, force, mediaMode, {
    audioQuality,
    extractAudio,
    stampVideo,
    preferMtime,
    rootDir: resolved.mode === 'folder' ? resolved.targetPath : null,
    sampleSeconds,
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

if (shouldShowLossyBanner(preflight) && !cleanupOriginals) {
    logConsole(LOSSY_BANNER);
}
if (sampleSeconds) {
    logConsole(`Sample mode: encoding the first ${sampleSeconds}s to *.sample.mp4 / *.sample.mp3 (full outputs are not written).`);
}

if (!verify && !cleanupOriginals) {
    logConsole('Warning: --no-verify is on. Outputs are unchecked; resume and deletes stay blocked.');
}

if (!dryRun && !cleanupOriginals) {
    const spaceDir = outputDir && fs.existsSync(outputDir)
        ? outputDir
        : outputDir
            ? path.dirname(outputDir)
            : sourceDir;
    try {
        const space = checkFreeSpace(spaceDir, estimateNeededBytes(preflight, { sampleSeconds }));
        if (!space.ok) {
            const message = formatDiskSpaceError(space);
            if (yes) logConsole(`Warning: ${message}`);
            else {
                console.error(`Error: ${message}`);
                process.exit(2);
            }
        }
    } catch (err) {
        logConsole(`Warning: could not check free space (${err.message}).`);
    }
}

if (force && !dryRun && !cleanupOriginals) {
    const overwriteCount = countOverwriteTargets(preflight);
    if (overwriteCount > 1) {
        logConsole(`--force will overwrite ${overwriteCount} existing output(s):`);
        for (const entry of preflight) {
            if (isConvertStatus(entry.videoStatus) && fs.existsSync(entry.out)) {
                logFile(`  overwrite ${entry.out}`);
            }
            if (entry.extractStatus && isConvertStatus(entry.extractStatus) && entry.audioOut && fs.existsSync(entry.audioOut)) {
                logFile(`  overwrite ${entry.audioOut}`);
            }
        }
        if (!await confirmContinue(formatForceOverwritePrompt(overwriteCount), { flagLabel: '--force' })) {
            logConsole('Cancelled.');
            process.exit(0);
        }
    } else if (overwriteCount === 1) {
        for (const entry of preflight) {
            if (isConvertStatus(entry.videoStatus) && fs.existsSync(entry.out)) {
                logConsole(`--force will overwrite ${entry.out}`);
            }
        }
    }
}

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
        preferMtime, embedArt, extractAudio, mediaMode, verbose, jobs, sampleSeconds, reencodeAudio,
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
    resumeState: !dryRun && !cleanupOriginals && !sampleSeconds
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
            intro: `Conversion finished. Sources below were converted successfully and will be ${deleteFate()}.`,
            countLabel: 'ready to delete',
            firstPrompt: deletePermanent ? 'Delete these originals now? [y/N]: ' : 'Move these originals to trash now? [y/N]: ',
            confirmedMessage: 'Delete originals confirmed.',
        });
        if (confirmed) {
            const { deleted, deleteFailed: delFail } = await deleteOriginalFiles(convertedInputs, logConsole, {
                permanent: deletePermanent,
            });
            deleteFailed = delFail;
            logConsole(`=== Deleted ${deleted} original(s), ${delFail} delete error(s) ===`);
        } else {
            logConsole('Delete originals cancelled.');
        }
    }
}

let archiveFailed = 0;
if (archiveDir && !cleanupOriginals) {
    const archiveCandidates = dryRun
        ? preflight.filter(e =>
            isConvertStatus(e.videoStatus) || (e.extractStatus && isConvertStatus(e.extractStatus)))
        : preflight.filter(e => convertedInputs.includes(e.input));
    const planned = archiveCandidates.map(entry => ({
        input: entry.input,
        dest: archiveDestPath(entry.input, archiveDir, { rootDir: resolveSourceRoot() }),
    }));

    if (planned.length === 0) {
        logConsole('No files converted successfully; --archive has nothing to move.');
    } else if (dryRun) {
        logger.printLines(formatArchivePlanLines(planned, { archiveDir, dryRun: true }));
        logConsole(`=== Would archive ${planned.length} original(s) after successful conversion (dry-run) ===`);
    } else {
        const confirmed = await confirmDeletion(archiveCandidates, {
            flagLabel: '--archive',
            intro: `Conversion finished. Sources below were converted successfully and will be moved to ${archiveDir}.`,
            countLabel: 'ready to archive',
            firstPrompt: 'Move these originals to the archive folder now? [y/N]: ',
            confirmedMessage: 'Archive confirmed.',
        });
        if (confirmed) {
            const { moved, failed } = moveOriginalsToArchive(convertedInputs, archiveDir, {
                rootDir: resolveSourceRoot(),
                logConsole,
            });
            archiveFailed = failed;
            logConsole(`=== Archived ${moved} original(s), ${failed} archive error(s) ===`);
        } else {
            logConsole('Archive cancelled.');
        }
    }
}

process.exit(stats.failed > 0 || deleteFailed > 0 || archiveFailed > 0 ? 1 : 0);

import fs from 'fs';
import path from 'path';
import { lameQuality } from './audio-policy.js';
import {
    applyOutputTimestamps,
    buildAudioFfmpegArgs,
    buildExtractAudioFfmpegArgs,
    buildFfmpegArgs,
    removePartialOutput,
    runFfmpeg,
    shouldDeinterlace,
} from './encode.js';
import { formatMtimeDate } from './paths.js';
import { isSkippableStatus } from './status.js';
import { hasDateTag } from './tags.js';
import { shellQuote } from './format.js';
import { secondsToHMS, formatHMSValue, formatTimeHMS, timeToSeconds } from './time.js';
import { verifyOutput } from './verify.js';
import { runWithConcurrency } from './jobs.js';

export async function runConversion({
    preflight,
    config,
    logger,
    progress,
    resumeState = null,
}) {
    const {
        dryRun, verify, keepPartial, quality, audioQuality, deinterlace, nvenc,
        preferMtime, embedArt, extractAudio, mediaMode, verbose, jobs = 1,
    } = config;

    const stats = { done: 0, skipped: 0, failed: 0, resumed: 0 };
    const failedPaths = [];
    const convertedInputs = [];

    function encodeWithFfmpeg(args, { activeFileBar, knownDuration } = {}) {
        let activeProc = null;
        return runFfmpeg(args, {
            setActiveProc: (proc) => {
                if (activeProc && !proc) {
                    progress.unregisterProc?.(activeProc);
                    activeProc = null;
                } else if (proc) {
                    activeProc = proc;
                    progress.registerProc?.(proc);
                }
            },
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

        if (jobStatus === 'skip (normalized)' || jobStatus === 'skip (exists)' || jobStatus === 'skip (resumed)') {
            stats.skipped++;
            logger.logFile(`Skipped${jobStatus.includes('normalized') ? ' (normalized)' : jobStatus.includes('resumed') ? ' (resumed)' : ''}: ${passName}`);
            return true;
        }

        if (dryRun) {
            if (jobStatus.startsWith('convert')) {
                stats.done++;
                if (verbose) {
                    const suffix = mode === 'video'
                        ? ` (deinterlace: ${shouldDeinterlace(deinterlace, meta) ? 'yadif' : 'none'})`
                        : mode === 'extract' ? ' (extract)' : lossyWarn ? ' (lossy)' : '';
                    logger.fileLog(`Would convert: ${passName} → ${path.basename(out)}${suffix}`, index, total);
                }
            }
            return true;
        }

        if (lossyWarn) {
            const msg = `[WARN] ${passName} → ${path.basename(out)} (lossy; source cannot be recovered from MP3)`;
            logger.logFile(msg);
            if (verbose) logger.logConsole(msg);
        }

        if (meta.duration <= 0) {
            logger.logFile(`[WARN] ${passName}: zero duration reported; progress may be approximate`);
        }

        if (!fs.existsSync(path.dirname(out))) fs.mkdirSync(path.dirname(out), { recursive: true });

        const knownDuration = meta.duration > 0;
        const barTotal = knownDuration ? Math.floor(meta.duration) : 3600;
        const activeFileBar = progress.createFileBar(barTotal, passName, {
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

        logger.logFile(`--- ${passName} ---`);
        if (mode === 'video') {
            const deinterlaceApplied = shouldDeinterlace(deinterlace, meta);
            logger.logFile(`Deinterlace: ${deinterlaceApplied ? 'yadif' : 'off'} (mode=${deinterlace}, field_order=${meta.field_order})`);
        } else {
            const artNote = embedArt ? (meta.hasCoverArt ? 'embed cover' : 'embed cover if present') : 'no cover';
            const dateNote = preferMtime && !hasDateTag(meta.tags) ? `date=${formatMtimeDate(input)} from mtime` : 'tags as-is';
            logger.logFile(`Encode: libmp3lame -q:a ${lameQuality(audioQuality)} | ${artNote} | ${dateNote}${mode === 'extract' ? ' | extract from video' : ''}`);
        }
        logger.logFile(`Command: ffmpeg ${args.map(shellQuote).join(' ')}`);

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
                    logger.logFile(`[WARN] ${passName}: ${warning}`);
                    if (verbose) logger.logConsole(`[WARN] ${passName}: ${warning}`);
                }
                try {
                    applyOutputTimestamps(input, out);
                } catch { }
                const outBase = path.basename(out);
                const detail = `✓ ${outBase} | Verified (${secondsToHMS(check.duration)}) | Metadata copied`;
                logger.logFile(`${detail} | --- end ${passName} (${elapsedStr}) ---`);
                logger.logToConsole(verbose ? detail : `✓ ${outBase}`);
            } else {
                try {
                    applyOutputTimestamps(input, out);
                } catch { }
                const outBase = path.basename(out);
                logger.logFile(`✓ ${outBase} | --- end ${passName} (${elapsedStr}) ---`);
                logger.logToConsole(verbose ? `✓ ${outBase}` : `✓ ${outBase}`);
            }

            stats.done++;
            activeFileBar.update(knownDuration ? Math.floor(meta.duration) : activeFileBar.value);
            return true;
        } catch (err) {
            const elapsedSec = (Date.now() - encodeStart) / 1000;
            logger.logConsole(`Error: ${passName} - ${err.message}`);
            logger.logFile(`--- end ${passName} (${elapsedSec.toFixed(1)}s, failed) ---`);
            removePartialOutput(out, keepPartial, (msg) => logger.logFile(msg));
            stats.failed++;
            if (!failedPaths.includes(input)) failedPaths.push(input);
            return false;
        }
    }

    async function processFile(entry, index) {
        if (progress.isShuttingDown()) return;

        const { input, out, audioOut, meta, videoStatus, extractStatus, lossy } = entry;
        const total = preflight.length;
        const base = path.basename(input);

        logger.logFile(`Processing: ${base} | Type: ${meta.mediaType} | Duration: ${secondsToHMS(meta.duration)} | Created: ${meta.creation_time} | Updated: ${meta.modified_time}`);

        if (videoStatus === 'unreadable') {
            stats.failed++;
            failedPaths.push(input);
            logger.logConsole(`Unreadable: ${base}`);
            progress.overallBar?.increment();
            return;
        }

        if (videoStatus === 'skip (wrong type)' && !extractStatus) {
            stats.skipped++;
            logger.logFile(`Skipped (wrong type): ${base}`);
            progress.overallBar?.increment();
            return;
        }

        if (dryRun) {
            if (isSkippableStatus(videoStatus)) {
                stats.skipped++;
            } else if (videoStatus.startsWith('convert')) stats.done++;
            if (extractStatus) {
                if (isSkippableStatus(extractStatus)) {
                    stats.skipped++;
                } else if (extractStatus.startsWith('convert')) stats.done++;
            }
            if (videoStatus === 'skip (resumed)' || extractStatus === 'skip (resumed)') {
                stats.resumed++;
                convertedInputs.push(input);
            }
            if (verbose && (videoStatus.startsWith('convert') || extractStatus?.startsWith('convert'))) {
                logger.fileLog(`Would process: ${base} (${entry.status})`, index, total);
            }
            progress.overallBar?.increment();
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

        let allOk = true;
        for (const job of jobs) {
            const ok = await runEncodePass({ input, meta, index, total, ...job });
            if (!ok) allOk = false;
            if (ok && job.jobStatus.startsWith('convert') && job.mode !== 'extract') {
                primaryConverted = true;
            }
        }

        if (allOk && jobs.length > 0) {
            resumeState?.markCompleted?.(input);
        }
        if (videoStatus === 'skip (resumed)' || extractStatus === 'skip (resumed)') {
            stats.resumed++;
        }
        if (primaryConverted || (allOk && jobs.some(j => j.jobStatus === 'skip (resumed)'))) {
            convertedInputs.push(input);
        }
        progress.overallBar?.increment();
    }

    await runWithConcurrency(
        preflight.length,
        dryRun ? 1 : jobs,
        (i) => processFile(preflight[i], i),
        { shouldStop: () => progress.isShuttingDown() },
    );

    return { stats, failedPaths, convertedInputs };
}

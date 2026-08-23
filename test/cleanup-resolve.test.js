import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildCleanupCandidates, deleteOriginalFiles, formatDeletionPlanLines } from '../lib/cleanup.js';
import { buildModeParts, formatUnknownExtensionError, mediaModeHint, resolveInputFiles, warnUnknownExtension } from '../lib/resolve-inputs.js';
import { createLogger, ensureLogDir } from '../lib/log.js';

describe('formatDeletionPlanLines', () => {
    it('formats candidate list', () => {
        const lines = formatDeletionPlanLines(
            [{ input: '/a/x.avi', out: '/a/x.mp4' }],
            { intro: 'Delete these', countLabel: 'ready', dryRun: true },
        );
        assert.ok(lines.some(l => l.includes('[DRY]')));
        assert.ok(lines.some(l => l.includes('/a/x.avi')));
    });
});

describe('buildCleanupCandidates', () => {
    it('skips non-existing outputs', () => {
        const { eligible, skipped } = buildCleanupCandidates(
            [{ status: 'convert → mp4', input: '/a.avi', out: '/a.mp4', meta: {} }],
            () => ({ ok: true }),
        );
        assert.equal(eligible.length, 0);
        assert.equal(skipped.length, 1);
    });

    it('accepts verified skip (exists) entries', () => {
        const { eligible } = buildCleanupCandidates(
            [{
                status: 'skip (exists)',
                input: '/a.avi',
                out: '/a.mp4',
                meta: { mediaType: 'video', duration: 60 },
            }],
            () => ({ ok: true }),
        );
        assert.equal(eligible.length, 1);
    });
});

describe('deleteOriginalFiles', () => {
    it('sends files to trash by default', async () => {
        const trashed = [];
        const { deleted } = await deleteOriginalFiles(['C:\\a.avi'], () => {}, {
            existsFn: () => true,
            trashFn: async (filePath) => { trashed.push(filePath); },
        });
        assert.equal(deleted, 1);
        assert.deepEqual(trashed, ['C:\\a.avi']);
    });

    it('unlinks only when permanent', async () => {
        const unlinked = [];
        const { deleted } = await deleteOriginalFiles(['C:\\a.avi'], () => {}, {
            permanent: true,
            existsFn: () => true,
            unlinkFn: (filePath) => { unlinked.push(filePath); },
            trashFn: async () => { throw new Error('should not trash'); },
        });
        assert.equal(deleted, 1);
        assert.deepEqual(unlinked, ['C:\\a.avi']);
    });
});

describe('resolveInputFiles', () => {
    it('detects single file mode', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-'));
        const file = path.join(tmp, 'clip.avi');
        fs.writeFileSync(file, '');
        const result = resolveInputFiles({ target: file, recursive: false, mediaMode: { video: true, audio: false } });
        assert.equal(result.mode, 'single');
        assert.equal(result.files[0], path.resolve(file));
        fs.rmSync(tmp, { recursive: true });
    });

    it('flags a single file with an unknown extension', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-'));
        const file = path.join(tmp, 'notes.txt');
        fs.writeFileSync(file, '');
        const resolved = resolveInputFiles({ target: file, recursive: false, mediaMode: { video: true, audio: true } });
        const warn = warnUnknownExtension(resolved, { video: true, audio: true });
        assert.ok(warn);
        assert.match(formatUnknownExtensionError(warn), /notes\.txt/);
        assert.match(formatUnknownExtensionError(warn), /video or audio/);
        fs.rmSync(tmp, { recursive: true });
    });

    it('accepts a single known media file', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-'));
        const file = path.join(tmp, 'clip.avi');
        fs.writeFileSync(file, '');
        const resolved = resolveInputFiles({ target: file, recursive: false, mediaMode: { video: true, audio: false } });
        assert.equal(warnUnknownExtension(resolved, { video: true, audio: false }), null);
        fs.rmSync(tmp, { recursive: true });
    });

    it('rejects a video file in audio-only mode', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-'));
        const file = path.join(tmp, 'clip.avi');
        fs.writeFileSync(file, '');
        const resolved = resolveInputFiles({ target: file, recursive: false, mediaMode: { video: false, audio: true } });
        const warn = warnUnknownExtension(resolved, { video: false, audio: true });
        assert.ok(warn);
        assert.match(formatUnknownExtensionError(warn), /audio/);
        fs.rmSync(tmp, { recursive: true });
    });
});

describe('buildModeParts', () => {
    it('includes dry-run flag', () => {
        const parts = buildModeParts({
            cleanupOriginals: false, combinedMode: true, audioOnlyMode: false,
            nvenc: false, quality: 'medium', deinterlace: 'auto',
            mediaMode: { video: true, audio: true }, preferMtime: false, embedArt: true,
            extractAudio: false, audioQuality: 'medium', verify: true, deleteOriginals: false, dryRun: true,
        });
        assert.ok(parts.includes('dry-run'));
        assert.ok(parts.includes('stamp'));
    });

    it('uses dupe-report mode parts', () => {
        const parts = buildModeParts({
            dupeReport: true, dupeHash: true, stampDates: false, cleanupOriginals: false,
            combinedMode: true, audioOnlyMode: false, nvenc: false, quality: 'medium',
            deinterlace: 'auto', mediaMode: { video: true, audio: true }, preferMtime: false,
            embedArt: true, extractAudio: false, audioQuality: 'medium', verify: true,
            deleteOriginals: false, dryRun: true,
        });
        assert.deepEqual(parts, ['dupe-report', 'hash', 'dry-run']);
    });

    it('uses stamp-dates mode parts', () => {
        const parts = buildModeParts({
            stampDates: true, cleanupOriginals: false, combinedMode: true, audioOnlyMode: false,
            nvenc: false, quality: 'medium', deinterlace: 'auto',
            mediaMode: { video: true, audio: true }, preferMtime: true, embedArt: true,
            extractAudio: false, audioQuality: 'medium', verify: true, deleteOriginals: false, dryRun: true,
        });
        assert.deepEqual(parts, ['stamp-dates', 'prefer-mtime', 'dry-run']);
    });

    it('omits stamp when video output stamping is off', () => {
        const parts = buildModeParts({
            stampVideo: false, cleanupOriginals: false, combinedMode: true, audioOnlyMode: false,
            nvenc: false, quality: 'medium', deinterlace: 'auto',
            mediaMode: { video: true, audio: true }, preferMtime: false, embedArt: true,
            extractAudio: false, audioQuality: 'medium', verify: true, deleteOriginals: false, dryRun: false,
        });
        assert.ok(!parts.includes('stamp'));
    });

    it('includes jobs when parallel', () => {
        const parts = buildModeParts({
            cleanupOriginals: false, combinedMode: false, audioOnlyMode: false,
            nvenc: true, quality: 'medium', deinterlace: 'auto',
            mediaMode: { video: true, audio: false }, preferMtime: false, embedArt: true,
            extractAudio: false, audioQuality: 'medium', verify: true, deleteOriginals: false, dryRun: false,
            jobs: 3,
        });
        assert.ok(parts.includes('jobs:3'));
    });

    it('includes reencode-audio when set', () => {
        const parts = buildModeParts({
            cleanupOriginals: false, combinedMode: true, audioOnlyMode: false,
            nvenc: false, quality: 'medium', deinterlace: 'auto',
            mediaMode: { video: true, audio: true }, preferMtime: false, embedArt: true,
            extractAudio: false, audioQuality: 'medium', verify: true, deleteOriginals: false, dryRun: false,
            reencodeAudio: true,
        });
        assert.ok(parts.includes('reencode-audio'));
    });
});

describe('createLogger', () => {
    it('writes timestamped lines to log file', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-log-'));
        const logPath = path.join(dir, 'test.log');
        ensureLogDir(logPath);
        const logger = createLogger({
            logFile: logPath,
            masterLogFile: path.join(dir, 'master.log'),
            masterLogEnabled: false,
            verbose: false,
        });
        logger.logFile('hello');
        const content = fs.readFileSync(logPath, 'utf8');
        assert.match(content, /\[.*\] hello/);
        fs.rmSync(dir, { recursive: true });
    });
});

describe('mediaModeHint', () => {
    it('returns combined hint', () => {
        assert.equal(mediaModeHint({ combinedMode: true, audioOnlyMode: false }), 'video or audio files');
    });
});

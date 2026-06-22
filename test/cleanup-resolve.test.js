import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildCleanupCandidates, formatDeletionPlanLines } from '../lib/cleanup.js';
import { buildModeParts, mediaModeHint, resolveInputFiles } from '../lib/resolve-inputs.js';
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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    classifyStatus,
    existingOutputUsable,
    isConvertStatus,
    isSkippableStatus,
    matchesMediaMode,
    formatEntryStatus,
} from '../lib/status.js';

describe('isConvertStatus', () => {
    it('detects convert statuses', () => {
        assert.equal(isConvertStatus('convert → mp4'), true);
        assert.equal(isConvertStatus('convert → mp4 + mp3 extract'), true);
        assert.equal(isConvertStatus('skip (exists)'), false);
    });
});

describe('isSkippableStatus', () => {
    it('detects skip statuses', () => {
        assert.equal(isSkippableStatus('skip (exists)'), true);
        assert.equal(isSkippableStatus('skip (normalized)'), true);
        assert.equal(isSkippableStatus('skip (resumed)'), true);
        assert.equal(isSkippableStatus('convert → mp3'), false);
    });
});

describe('matchesMediaMode', () => {
    it('respects audio-only mode', () => {
        assert.equal(matchesMediaMode({ mediaType: 'audio' }, { video: false, audio: true }), true);
        assert.equal(matchesMediaMode({ mediaType: 'video' }, { video: false, audio: true }), false);
    });

    it('allows both in combined mode', () => {
        assert.equal(matchesMediaMode({ mediaType: 'video' }, { video: true, audio: true }), true);
        assert.equal(matchesMediaMode({ mediaType: 'audio' }, { video: true, audio: true }), true);
    });
});

describe('existingOutputUsable', () => {
    it('rejects empty files and failed probes', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-out-'));
        const empty = path.join(tmp, 'clip.mp4');
        const good = path.join(tmp, 'good.mp4');
        fs.writeFileSync(empty, '');
        fs.writeFileSync(good, 'not-empty');
        assert.equal(existingOutputUsable(empty, 'video', { probeFn: () => ({ valid: true, mediaType: 'video' }) }), false);
        assert.equal(existingOutputUsable(good, 'video', { probeFn: () => ({ valid: false }) }), false);
        assert.equal(existingOutputUsable(good, 'video', { probeFn: () => ({ valid: true, mediaType: 'audio' }) }), false);
        assert.equal(existingOutputUsable(good, 'video', { probeFn: () => ({ valid: true, mediaType: 'video' }) }), true);
        fs.rmSync(tmp, { recursive: true });
    });
});

describe('classifyStatus', () => {
    it('converts when the existing output is empty', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-cls-'));
        const input = path.join(tmp, 'clip.avi');
        const out = path.join(tmp, 'clip.mp4');
        fs.writeFileSync(input, 'x');
        fs.writeFileSync(out, '');
        const status = classifyStatus(input, { valid: true, mediaType: 'video' }, out, false, { video: true, audio: false }, 'medium', {
            outputUsableFn: () => false,
        });
        assert.equal(status, 'convert → mp4');
        fs.rmSync(tmp, { recursive: true });
    });
});

describe('formatEntryStatus', () => {
    it('combines video and extract convert statuses', () => {
        assert.equal(
            formatEntryStatus('convert → mp4', 'convert → mp3 [extract]'),
            'convert → mp4 + mp3 extract',
        );
    });

    it('combines skip statuses', () => {
        assert.equal(
            formatEntryStatus('skip (exists)', 'skip (exists)'),
            'skip (exists); mp3 (exists)',
        );
    });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasVideoExt, hasAudioExt, hasMediaExt, isLossyAudioSource } from '../lib/extensions.js';

describe('hasVideoExt', () => {
    it('recognizes video extensions', () => {
        assert.equal(hasVideoExt('clip.AVI'), true);
        assert.equal(hasVideoExt('song.mp3'), false);
    });
});

describe('hasMediaExt', () => {
    it('filters by media mode', () => {
        assert.equal(hasMediaExt('a.flac', { video: false, audio: true }), true);
        assert.equal(hasMediaExt('a.flac', { video: true, audio: false }), false);
        assert.equal(hasMediaExt('clip.mp4', { video: true, audio: true }), false);
        assert.equal(hasMediaExt('clip.mp4', { video: true, audio: true }, { stampDates: true }), true);
    });
});

describe('isLossyAudioSource', () => {
    it('flags lossless extensions', () => {
        assert.equal(isLossyAudioSource('track.flac'), true);
        assert.equal(isLossyAudioSource('track.mp3'), false);
    });
});

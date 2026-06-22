import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    lameQuality,
    mp3BitrateFloorKbps,
    isNormalizedMp3,
    hasBasicTags,
} from '../lib/audio-policy.js';

describe('lameQuality', () => {
    it('maps presets to LAME -q:a values', () => {
        assert.equal(lameQuality('high'), '0');
        assert.equal(lameQuality('medium'), '2');
        assert.equal(lameQuality('fast'), '4');
    });
});

describe('mp3BitrateFloorKbps', () => {
    it('returns preset floors', () => {
        assert.equal(mp3BitrateFloorKbps('high'), 224);
        assert.equal(mp3BitrateFloorKbps('medium'), 160);
        assert.equal(mp3BitrateFloorKbps('fast'), 128);
    });
});

describe('isNormalizedMp3', () => {
    const baseMeta = {
        audioCodec: 'mp3',
        audioBitrate: 192_000,
        tagCount: 3,
        tags: { title: 'Track', artist: 'Artist' },
    };

    it('accepts good MP3 with tags and bitrate', () => {
        assert.equal(isNormalizedMp3('/music/song.mp3', baseMeta, 'medium'), true);
    });

    it('rejects low bitrate', () => {
        assert.equal(isNormalizedMp3('/music/song.mp3', { ...baseMeta, audioBitrate: 96_000 }, 'medium'), false);
    });

    it('rejects missing tags', () => {
        assert.equal(isNormalizedMp3('/music/song.mp3', { ...baseMeta, tags: {}, tagCount: 0 }, 'medium'), false);
    });

    it('rejects non-mp3 codec', () => {
        assert.equal(isNormalizedMp3('/music/song.flac', { ...baseMeta, audioCodec: 'flac' }, 'medium'), false);
    });
});

describe('hasBasicTags', () => {
    it('accepts title', () => {
        assert.equal(hasBasicTags({ tags: { title: 'A' }, tagCount: 1 }), true);
    });
});

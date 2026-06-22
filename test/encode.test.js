import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    shouldDeinterlace,
    buildVideoFilter,
    buildFfmpegArgs,
    buildAudioFfmpegArgs,
} from '../lib/encode.js';

describe('shouldDeinterlace', () => {
    it('respects auto mode from metadata', () => {
        assert.equal(shouldDeinterlace('auto', { interlaced: true }), true);
        assert.equal(shouldDeinterlace('auto', { interlaced: false }), false);
    });

    it('respects on/off overrides', () => {
        assert.equal(shouldDeinterlace('on', { interlaced: false }), true);
        assert.equal(shouldDeinterlace('off', { interlaced: true }), false);
    });
});

describe('buildFfmpegArgs', () => {
    const meta = { interlaced: true, field_order: 'tt' };

    it('includes yadif when deinterlacing', () => {
        const args = buildFfmpegArgs('in.avi', 'out.mp4', meta, { quality: 'medium', nvenc: false, deinterlaceMode: 'auto' });
        assert.ok(args.includes('-vf'));
        assert.ok(args.includes('yadif'));
        assert.ok(args.includes('libx264'));
    });

    it('uses NVENC when requested', () => {
        const args = buildFfmpegArgs('in.avi', 'out.mp4', { interlaced: false }, { quality: 'high', nvenc: true, deinterlaceMode: 'off' });
        assert.ok(args.includes('h264_nvenc'));
        assert.equal(buildVideoFilter('off', { interlaced: true }), null);
    });
});

describe('buildAudioFfmpegArgs', () => {
    it('uses LAME quality preset', () => {
        const args = buildAudioFfmpegArgs('in.flac', 'out.mp3', {
            audioQuality: 'medium',
            embedArt: false,
            preferMtime: false,
            meta: { tags: { title: 'x' } },
        });
        assert.ok(args.includes('libmp3lame'));
        assert.ok(args.includes('-q:a'));
        assert.ok(args.includes('2'));
        assert.ok(args.includes('out.mp3'));
    });
});

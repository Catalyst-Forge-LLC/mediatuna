import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    shouldDeinterlace,
    buildVideoFilter,
    buildFfmpegArgs,
    buildAudioFfmpegArgs,
    nvencSupportsFrame,
    sampleDuration,
    withSampleLimit,
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

    it('falls back to libx264 when the frame is below the NVENC minimum', () => {
        const args = buildFfmpegArgs('in.3g2', 'out.mp4', { interlaced: false, width: 128, height: 96 }, {
            quality: 'medium', nvenc: true, deinterlaceMode: 'off',
        });
        assert.ok(args.includes('libx264'));
        assert.ok(!args.includes('h264_nvenc'));
    });

    it('limits duration for --sample', () => {
        const args = buildFfmpegArgs('in.avi', 'out.sample.mp4', { interlaced: false }, {
            quality: 'fast', nvenc: false, deinterlaceMode: 'off', sampleSeconds: 5,
        });
        const dashT = args.indexOf('-t');
        assert.ok(dashT > args.indexOf('-i'));
        assert.equal(args[dashT + 1], '5');
        assert.equal(args.at(-1), 'out.sample.mp4');
    });
});

describe('sampleDuration / withSampleLimit', () => {
    it('clips expected duration to the sample length', () => {
        assert.equal(sampleDuration(120, null), 120);
        assert.equal(sampleDuration(120, 20), 20);
        assert.equal(sampleDuration(5, 20), 5);
        assert.equal(sampleDuration(0, 20), 20);
    });

    it('inserts -t after the input path', () => {
        const args = withSampleLimit(['-i', 'in.avi', 'out.mp4'], 8);
        assert.deepEqual(args, ['-i', 'in.avi', '-t', '8', 'out.mp4']);
    });
});

describe('nvencSupportsFrame', () => {
    it('rejects phone-camcorder sizes and allows unknown dimensions', () => {
        assert.equal(nvencSupportsFrame({ width: 128, height: 96 }), false);
        assert.equal(nvencSupportsFrame({ width: 1920, height: 1080 }), true);
        assert.equal(nvencSupportsFrame({}), true);
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

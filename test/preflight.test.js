import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { buildPreflightTableLines } from '../lib/preflight.js';
import { outputPath } from '../lib/paths.js';

describe('outputPath', () => {
    it('maps video and audio extensions', () => {
        assert.match(outputPath('/a/clip.avi', null, 'video'), /clip\.mp4$/);
        assert.equal(outputPath('/a/track.flac', '/out', 'audio'), path.join('/out', 'track.mp3'));
    });

    it('stamps video output names when metadata has a date and the file does not', () => {
        const out = outputPath('/a/Video010.3g2', null, 'video', {
            stamp: true,
            meta: { creation_time: '2006-07-27T19:32:22.000000Z' },
        });
        assert.match(out, /2006-07-27_19-32-22Z_Video010\.mp4$/);
    });

    it('keeps an existing date prefix instead of updating it', () => {
        const out = outputPath('/a/2006-07-27_19-32-22Z_Video010.3g2', null, 'video', {
            stamp: true,
            meta: { creation_time: '2006-08-08T19:26:20.000000Z' },
        });
        assert.match(out, /2006-07-27_19-32-22Z_Video010\.mp4$/);
    });
});

describe('buildPreflightTableLines', () => {
    it('summarizes entries', () => {
        const { lines, counts } = buildPreflightTableLines([
            {
                input: '/x/a.avi',
                status: 'convert → mp4',
                meta: { mediaType: 'video', duration: 60, size: 1000 },
            },
            {
                input: '/x/b.mp3',
                status: 'skip (normalized)',
                meta: { mediaType: 'audio', duration: 180, size: 5000 },
            },
        ], false);

        assert.equal(counts.convert, 1);
        assert.equal(counts.skip, 1);
        assert.ok(lines.some(l => l.includes('convert → mp4')));
        assert.ok(lines.some(l => l.includes('2 file(s): 1 to convert, 1 skip')));
    });

    it('uses would convert in dry-run', () => {
        const { lines } = buildPreflightTableLines([
            {
                input: '/x/a.avi',
                status: 'convert → mp4',
                meta: { mediaType: 'video', duration: 0, size: 0 },
            },
        ], true);
        assert.ok(lines.some(l => l.includes('would convert → mp4')));
    });
});

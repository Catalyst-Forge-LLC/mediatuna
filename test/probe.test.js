import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseProbeResult } from '../lib/probe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures', 'ffprobe');

function loadFixture(name) {
    return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8'));
}

const fakeStats = {
    size: 8_000_000,
    mtime: new Date('2020-01-15T12:00:00.000Z'),
};

describe('parseProbeResult', () => {
    it('classifies MP3 audio', () => {
        const meta = parseProbeResult(loadFixture('audio-mp3.json'), fakeStats);
        assert.equal(meta.mediaType, 'audio');
        assert.equal(meta.valid, true);
        assert.equal(meta.audioCodec, 'mp3');
        assert.equal(meta.audioBitrate, 192_000);
        assert.equal(meta.tagCount, 3);
        assert.equal(meta.duration, 225.504);
    });

    it('classifies interlaced video with audio', () => {
        const meta = parseProbeResult(loadFixture('video-interlaced.json'), fakeStats);
        assert.equal(meta.mediaType, 'video');
        assert.equal(meta.interlaced, true);
        assert.equal(meta.field_order, 'tt');
        assert.equal(meta.audioCodec, 'aac');
    });

    it('returns unreadable for empty probe data', () => {
        const meta = parseProbeResult({}, fakeStats);
        assert.equal(meta.mediaType, 'unreadable');
        assert.equal(meta.valid, false);
    });
});

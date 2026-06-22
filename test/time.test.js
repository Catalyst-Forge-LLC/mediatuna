import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { timeToSeconds, secondsToHMS, formatTimeHMS } from '../lib/time.js';

describe('timeToSeconds', () => {
    it('parses HH:MM:SS', () => {
        assert.equal(timeToSeconds('01:02:03'), 3723);
    });

    it('parses MM:SS', () => {
        assert.equal(timeToSeconds('02:30'), 150);
    });

    it('parses seconds only', () => {
        assert.equal(timeToSeconds('45.5'), 45);
    });

    it('handles ffmpeg-style fractional seconds', () => {
        assert.equal(timeToSeconds('00:01:02.48'), 62);
    });
});

describe('secondsToHMS', () => {
    it('formats zero', () => {
        assert.equal(secondsToHMS(0), '00:00:00');
    });

    it('formats hours', () => {
        assert.equal(secondsToHMS(3661), '01:01:01');
    });

    it('clamps negatives', () => {
        assert.equal(secondsToHMS(-5), '00:00:00');
    });
});

describe('formatTimeHMS', () => {
    it('returns placeholder for invalid values', () => {
        assert.equal(formatTimeHMS('NULL'), '--:--:--');
        assert.equal(formatTimeHMS(NaN), '--:--:--');
    });
});

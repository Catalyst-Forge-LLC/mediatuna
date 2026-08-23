import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { durationToleranceSeconds, durationWithinTolerance } from '../lib/verify.js';

describe('durationWithinTolerance', () => {
    it('uses a 2s floor on short clips', () => {
        assert.equal(durationToleranceSeconds(10), 2);
        assert.equal(durationWithinTolerance(11.5, 10), true);
        assert.equal(durationWithinTolerance(13, 10), false);
    });

    it('uses 5% on long clips', () => {
        assert.equal(durationToleranceSeconds(200), 10);
        assert.equal(durationWithinTolerance(209, 200), true);
        assert.equal(durationWithinTolerance(211, 200), false);
    });

    it('skips the check when a duration is missing', () => {
        assert.equal(durationWithinTolerance(0, 60), true);
        assert.equal(durationWithinTolerance(60, 0), true);
    });
});

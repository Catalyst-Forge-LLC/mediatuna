import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createdIsMovedCopy } from '../lib/timestamps.js';

describe('createdIsMovedCopy', () => {
    it('detects created more than a month after modified', () => {
        const times = {
            mtime: new Date('2015-10-07T12:00:00'),
            birthtime: new Date('2026-08-16T18:36:00'),
            ctime: new Date('2026-08-16T18:36:00'),
        };
        assert.equal(createdIsMovedCopy(times), true);
        assert.equal(createdIsMovedCopy({
            ...times,
            birthtime: new Date('2015-10-07T12:05:00'),
        }), false);
    });
});

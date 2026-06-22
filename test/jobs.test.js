import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_JOBS,
    MAX_JOBS,
    parseJobsValue,
    resolveEffectiveJobs,
    runWithConcurrency,
} from '../lib/jobs.js';

describe('parseJobsValue', () => {
    it('defaults to 1', () => {
        assert.equal(parseJobsValue(undefined), DEFAULT_JOBS);
    });

    it('accepts valid integers', () => {
        assert.equal(parseJobsValue('3'), 3);
        assert.equal(parseJobsValue(2), 2);
    });

    it('rejects invalid values', () => {
        assert.throws(() => parseJobsValue('0'), /positive integer/);
        assert.throws(() => parseJobsValue('1.5'), /positive integer/);
        assert.throws(() => parseJobsValue(String(MAX_JOBS + 1)), /cannot exceed/);
    });
});

describe('resolveEffectiveJobs', () => {
    it('returns 1 for single-job runs', () => {
        assert.equal(resolveEffectiveJobs(1, { nvenc: true, mediaMode: { video: true, audio: true } }), 1);
    });

    it('caps CPU video encodes to available cores', () => {
        const jobs = resolveEffectiveJobs(8, { nvenc: false, mediaMode: { video: true, audio: false } });
        assert.ok(jobs >= 1);
        assert.ok(jobs <= MAX_JOBS);
    });

    it('allows full NVENC concurrency', () => {
        assert.equal(resolveEffectiveJobs(4, { nvenc: true, mediaMode: { video: true, audio: true } }), 4);
    });
});

describe('runWithConcurrency', () => {
    it('runs all items with bounded concurrency', async () => {
        const order = [];
        let active = 0;
        let peak = 0;

        await runWithConcurrency(6, 2, async (i) => {
            order.push(`start:${i}`);
            active++;
            peak = Math.max(peak, active);
            await new Promise(r => setTimeout(r, 5));
            active--;
            order.push(`end:${i}`);
        });

        assert.equal(order.filter(x => x.startsWith('start:')).length, 6);
        assert.ok(peak <= 2);
    });

    it('stops early when shouldStop is set', async () => {
        let count = 0;
        await runWithConcurrency(10, 1, async () => {
            count++;
        }, {
            shouldStop: () => count >= 2,
        });
        assert.equal(count, 2);
    });
});

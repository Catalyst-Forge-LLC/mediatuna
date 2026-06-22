import os from 'os';

export const DEFAULT_JOBS = 1;
export const MAX_JOBS = 8;

export function parseJobsValue(raw) {
    if (raw === undefined || raw === null) return DEFAULT_JOBS;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
        throw new Error('--jobs requires a positive integer.');
    }
    if (n > MAX_JOBS) {
        throw new Error(`--jobs cannot exceed ${MAX_JOBS}.`);
    }
    return n;
}

export function resolveEffectiveJobs(requested, { nvenc, mediaMode }) {
    const jobs = requested ?? DEFAULT_JOBS;
    if (jobs <= 1) return 1;

    if (mediaMode.video && !nvenc) {
        const cpuCap = Math.max(1, Math.min(MAX_JOBS, os.cpus().length));
        return Math.min(jobs, cpuCap);
    }

    return jobs;
}

export async function runWithConcurrency(itemCount, concurrency, worker, { shouldStop = () => false } = {}) {
    if (itemCount <= 0) return;
    if (concurrency <= 1 || itemCount <= 1) {
        for (let i = 0; i < itemCount; i++) {
            if (shouldStop()) break;
            await worker(i);
        }
        return;
    }

    let nextIndex = 0;
    async function runWorker() {
        while (!shouldStop()) {
            const i = nextIndex++;
            if (i >= itemCount) return;
            await worker(i);
        }
    }

    const workerCount = Math.min(concurrency, itemCount);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}

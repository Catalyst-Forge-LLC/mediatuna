import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    LOSSY_BANNER,
    checkFreeSpace,
    countOverwriteTargets,
    estimateNeededBytes,
    formatDiskSpaceError,
    formatWriteLocationBanner,
    shouldShowLossyBanner,
} from '../lib/safety.js';

describe('formatWriteLocationBanner', () => {
    it('names the output folder or the source folder', () => {
        assert.equal(
            formatWriteLocationBanner({ count: 3, outputDir: 'D:\\out', sourceDir: 'C:\\in' }),
            'Writing 3 output(s) under D:\\out (source subfolders kept).',
        );
        assert.equal(
            formatWriteLocationBanner({ count: 3, outputDir: null, sourceDir: 'C:\\in' }),
            'Writing 3 file(s) beside sources in C:\\in.',
        );
    });
});

describe('shouldShowLossyBanner', () => {
    it('shows the banner when any file will convert', () => {
        assert.equal(shouldShowLossyBanner([{ videoStatus: 'skip (exists)' }]), false);
        assert.equal(shouldShowLossyBanner([{ videoStatus: 'convert → mp4' }]), true);
        assert.match(LOSSY_BANNER, /lossy/);
    });
});

describe('estimateNeededBytes / checkFreeSpace', () => {
    it('estimates video convert size with a reserve', () => {
        const needed = estimateNeededBytes([{
            videoStatus: 'convert → mp4',
            meta: { mediaType: 'video', size: 1000 },
        }]);
        assert.equal(needed, 1200);
    });

    it('reports short disk space from a mock statfs', () => {
        const check = checkFreeSpace('C:\\out', 1000, {
            reserveBytes: 100,
            statfsFn: () => ({ bavail: 2, bsize: 10 }),
        });
        assert.equal(check.ok, false);
        assert.equal(check.free, 20);
        assert.match(formatDiskSpaceError(check), /Not enough free space/);
    });

    it('counts existing outputs that --force will overwrite', () => {
        const count = countOverwriteTargets([
            { videoStatus: 'convert → mp4', out: 'a.mp4' },
            { videoStatus: 'skip (exists)', out: 'b.mp4' },
        ], { existsFn: (p) => p === 'a.mp4' });
        assert.equal(count, 1);
    });
});

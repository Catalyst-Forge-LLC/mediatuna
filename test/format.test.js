import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSize, padEnd, shellQuote, formatFfmpegError } from '../lib/format.js';

describe('formatSize', () => {
    it('formats bytes and KB', () => {
        assert.equal(formatSize(512), '512 B');
        assert.equal(formatSize(2048), '2.0 KB');
    });

    it('formats MB and GB', () => {
        assert.equal(formatSize(5_000_000), '5.0 MB');
        assert.equal(formatSize(2_500_000_000), '2.5 GB');
    });
});

describe('padEnd', () => {
    it('pads short strings', () => {
        assert.equal(padEnd('hi', 5), 'hi   ');
    });

    it('truncates long strings', () => {
        assert.equal(padEnd('hello world', 5), 'hello');
    });
});

describe('shellQuote', () => {
    it('quotes paths with spaces', () => {
        assert.equal(shellQuote('C:\\My Videos\\clip.avi'), '"C:\\My Videos\\clip.avi"');
    });

    it('leaves simple paths unquoted', () => {
        assert.equal(shellQuote('clip.avi'), 'clip.avi');
    });
});

describe('formatFfmpegError', () => {
    it('returns last meaningful stderr line', () => {
        const stderr = 'ffmpeg version 6.0\nError opening input: No such file\n';
        assert.equal(formatFfmpegError(stderr, 'failed'), 'Error opening input: No such file');
    });

    it('falls back when stderr is empty', () => {
        assert.equal(formatFfmpegError('', 'encode failed'), 'encode failed');
    });
});

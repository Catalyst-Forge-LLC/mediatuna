import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { discoverFiles } from '../lib/discover.js';
import { filterByGlobs, parseGlobList, pathMatchesGlob } from '../lib/globs.js';

describe('parseGlobList', () => {
    it('splits comma lists and repeated flags', () => {
        assert.deepEqual(parseGlobList(['*.avi', 'previews/**,*.tmp']), ['*.avi', 'previews/**', '*.tmp']);
    });
});

describe('pathMatchesGlob / filterByGlobs', () => {
    const root = 'C:\\tapes';
    const clip = path.join(root, '2008', 'clip.avi');
    const preview = path.join(root, 'previews', 'thumb.avi');

    it('matches basename includes and folder excludes', () => {
        assert.equal(pathMatchesGlob(clip, '*.avi', root), true);
        assert.equal(pathMatchesGlob(clip, '*.mp3', root), false);
        assert.equal(pathMatchesGlob(preview, 'previews/**', root), true);
        assert.equal(pathMatchesGlob(preview, 'previews', root), true);
    });

    it('applies include then exclude', () => {
        const files = [clip, preview, path.join(root, 'song.mp3')];
        assert.deepEqual(
            filterByGlobs(files, { include: ['*.avi'], exclude: ['previews/**'], rootDir: root }),
            [clip],
        );
    });
});

describe('discoverFiles', () => {
    it('excludes a previews folder when recursive', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-disc-'));
        fs.mkdirSync(path.join(dir, '2008'));
        fs.mkdirSync(path.join(dir, 'previews'));
        const keep = path.join(dir, '2008', 'clip.avi');
        const drop = path.join(dir, 'previews', 'thumb.avi');
        fs.writeFileSync(keep, 'x');
        fs.writeFileSync(drop, 'x');
        const files = await discoverFiles(dir, true, { video: true, audio: false }, {
            exclude: ['previews'],
        });
        assert.ok(files.some(f => path.resolve(f) === path.resolve(keep)));
        assert.ok(!files.some(f => path.resolve(f) === path.resolve(drop)));
        fs.rmSync(dir, { recursive: true });
    });
});

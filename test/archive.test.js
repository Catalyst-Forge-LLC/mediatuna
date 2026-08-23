import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { archiveDestPath, moveOriginalsToArchive } from '../lib/archive.js';

describe('archiveDestPath', () => {
    it('keeps the path relative to the scan root', () => {
        assert.equal(
            archiveDestPath('C:\\tapes\\2008\\clip.avi', 'D:\\done', { rootDir: 'C:\\tapes' }),
            path.join('D:\\done', '2008', 'clip.avi'),
        );
    });
});

describe('moveOriginalsToArchive', () => {
    it('moves a source into the archive tree', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-arch-'));
        const srcDir = path.join(dir, 'tapes', '2008');
        const archiveDir = path.join(dir, 'done');
        fs.mkdirSync(srcDir, { recursive: true });
        const src = path.join(srcDir, 'clip.avi');
        fs.writeFileSync(src, 'tape');
        const { moved, failed } = moveOriginalsToArchive([src], archiveDir, { rootDir: path.join(dir, 'tapes') });
        assert.equal(moved, 1);
        assert.equal(failed, 0);
        assert.equal(fs.existsSync(src), false);
        assert.equal(fs.readFileSync(path.join(archiveDir, '2008', 'clip.avi'), 'utf8'), 'tape');
        fs.rmSync(dir, { recursive: true });
    });
});

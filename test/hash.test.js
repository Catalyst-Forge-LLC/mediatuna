import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { sha256File } from '../lib/hash.js';

describe('sha256File', () => {
    it('matches identical bytes and differs when content changes', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-hash-'));
        const a = path.join(dir, 'a.bin');
        const b = path.join(dir, 'b.bin');
        fs.writeFileSync(a, 'same-bytes');
        fs.writeFileSync(b, 'same-bytes');
        const ha = await sha256File(a);
        const hb = await sha256File(b);
        assert.equal(ha, hb);
        assert.equal(ha.length, 64);
        fs.writeFileSync(b, 'other-bytes');
        assert.notEqual(await sha256File(b), ha);
        fs.rmSync(dir, { recursive: true });
    });
});

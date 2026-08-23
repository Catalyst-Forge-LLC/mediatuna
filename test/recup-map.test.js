import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    applyRecupTree,
    collectRecupCleanup,
    parseExtList,
    pickPlacement,
    proposedRelPath,
    scoreHit,
    uniqueDestPath,
} from '../lib/recup-map.js';

describe('scoreHit / proposedRelPath', () => {
    it('prefers disk-image voicenotes over recup and junk', () => {
        const good = 'I:\\diskimages\\Family Laptop\\Parent\\user@example.com\\Memories\\Voicenotes\\2010-09-24\\Recording011.mp3';
        const inbox = 'C:\\Users\\user\\VoiceNotes\\__inbox\\2010-09\\2010-09-24-Recording011.mp3';
        const recup = 'S:\\drive-images\\photorec-dump\\recup_dir.99\\f20352264.mp3';
        const junk = 'E:\\library\\.photostructure\\previews\\000\\410\\04-fit-w320.jpg';
        assert.ok(scoreHit(good) > scoreHit(inbox));
        assert.ok(scoreHit(inbox) > 0);
        assert.ok(scoreHit(recup) <= 0);
        assert.ok(scoreHit(junk) <= 0);
        assert.equal(proposedRelPath(good), 'Memories/Voicenotes/2010-09-24/Recording011.mp3');
    });
});

describe('pickPlacement', () => {
    it('places a file from the best external copy', () => {
        const placement = pickPlacement([
            { path: 'S:\\dump\\recup_dir.1\\f001.mp3', size: 10 },
            { path: 'I:\\diskimages\\Family\\Memories\\Voicenotes\\2010-09-20\\Recording.mp3', size: 10 },
        ]);
        assert.equal(placement.proposed, 'Memories/Voicenotes/2010-09-20/Recording.mp3');
        assert.equal(placement.ambiguous, false);
    });

    it('returns null when only junk hits exist', () => {
        assert.equal(pickPlacement([
            { path: 'C:\\Users\\x\\AppData\\Local\\cache\\x.mp3', size: 10 },
        ]), null);
    });
});

describe('applyRecupTree', () => {
    it('copies placed files into the proposed tree', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-recup-'));
        const src = path.join(dir, 'f001.mp3');
        fs.writeFileSync(src, 'note');
        const treeDir = path.join(dir, 'proposed-tree');
        const result = applyRecupTree([{
            input: src,
            placement: { proposed: 'Memories/Voicenotes/clip.mp3', ambiguous: false },
        }], treeDir);
        const dest = path.join(treeDir, 'Memories', 'Voicenotes', 'clip.mp3');
        assert.equal(result.copied, 1);
        assert.equal(fs.readFileSync(dest, 'utf8'), 'note');
        const again = applyRecupTree([{
            input: src,
            placement: { proposed: 'Memories/Voicenotes/clip.mp3', ambiguous: false },
        }], treeDir);
        assert.equal(again.copied, 0);
        assert.equal(again.skipped, 1);
        fs.rmSync(dir, { recursive: true });
    });

    it('skips copies when --hash is required and the gold file differs', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-recup-hash-apply-'));
        const src = path.join(dir, 'f001.mp3');
        fs.writeFileSync(src, 'note');
        const treeDir = path.join(dir, 'proposed-tree');
        const result = applyRecupTree([{
            input: src,
            hashMatch: false,
            placement: { proposed: 'Memories/clip.mp3', ambiguous: false },
        }], treeDir, { requireHash: true });
        assert.equal(result.copied, 0);
        assert.equal(fs.existsSync(path.join(treeDir, 'Memories', 'clip.mp3')), false);
        fs.rmSync(dir, { recursive: true });
    });
});

describe('collectRecupCleanup', () => {
    it('lists recup sources that have a SHA-256 match in the tree', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-recup-clean-'));
        const recup = path.join(dir, 'recup_dir.1');
        const treeDir = path.join(dir, 'proposed-tree');
        fs.mkdirSync(recup, { recursive: true });
        fs.mkdirSync(path.join(treeDir, 'Memories'), { recursive: true });
        const src = path.join(recup, 'f001.mp3');
        const dest = path.join(treeDir, 'Memories', 'clip.mp3');
        fs.writeFileSync(src, 'note');
        fs.writeFileSync(dest, 'note');
        const rows = [{
            input: src,
            placement: { proposed: 'Memories/clip.mp3', ambiguous: false },
        }];
        const eligible = await collectRecupCleanup(rows, treeDir, { rootDir: dir });
        assert.equal(eligible.length, 1);
        assert.equal(eligible[0].input, path.resolve(src));
        fs.writeFileSync(dest, 'different');
        assert.equal((await collectRecupCleanup(rows, treeDir, { rootDir: dir })).length, 0);
        fs.rmSync(dir, { recursive: true });
    });

    it('does not delete same-size files with different bytes', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-recup-hash-'));
        const recup = path.join(dir, 'recup_dir.1');
        const treeDir = path.join(dir, 'proposed-tree');
        fs.mkdirSync(recup, { recursive: true });
        fs.mkdirSync(treeDir, { recursive: true });
        const src = path.join(recup, 'f001.mp3');
        const dest = path.join(treeDir, 'clip.mp3');
        fs.writeFileSync(src, 'aaaa');
        fs.writeFileSync(dest, 'bbbb');
        const eligible = await collectRecupCleanup([{
            input: src,
            placement: { proposed: 'clip.mp3', ambiguous: false },
        }], treeDir, { rootDir: dir });
        assert.equal(eligible.length, 0);
        fs.rmSync(dir, { recursive: true });
    });

    it('does not list files that live inside the proposed tree', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-recup-tree-'));
        const treeDir = path.join(dir, 'proposed-tree');
        const dest = path.join(treeDir, 'clip.mp3');
        fs.mkdirSync(treeDir, { recursive: true });
        fs.writeFileSync(dest, 'note');
        const eligible = await collectRecupCleanup([{
            input: dest,
            placement: { proposed: 'clip.mp3', ambiguous: false },
        }], treeDir, { rootDir: dir });
        assert.equal(eligible.length, 0);
        fs.rmSync(dir, { recursive: true });
    });
});

describe('uniqueDestPath', () => {
    it('adds a suffix when the destination exists', () => {
        assert.equal(uniqueDestPath('a.mp3', () => false), 'a.mp3');
        assert.equal(uniqueDestPath('a.mp3', (p) => p === 'a.mp3'), 'a-2.mp3');
    });
});

describe('parseExtList', () => {
    it('defaults to media extensions and accepts a custom list', () => {
        assert.ok(parseExtList(null).has('mp3'));
        assert.ok(parseExtList(null).has('3g2'));
        assert.deepEqual([...parseExtList('mp3,wav')], ['mp3', 'wav']);
    });
});

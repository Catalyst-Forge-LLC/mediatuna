import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseExtList,
    pickPlacement,
    proposedRelPath,
    scoreHit,
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

describe('parseExtList', () => {
    it('defaults to media extensions and accepts a custom list', () => {
        assert.ok(parseExtList(null).has('mp3'));
        assert.ok(parseExtList(null).has('3g2'));
        assert.deepEqual([...parseExtList('mp3,wav')], ['mp3', 'wav']);
    });
});

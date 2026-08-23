import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    buildLedgerRecord,
    buildLedgerRemuxArgs,
    defaultLedgerJsonPath,
    formatLedgerComment,
    isoFromParsed,
    relativeLedgerPath,
    resetSidecarQueue,
    resolveLedgerDate,
    upsertLedgerSidecar,
} from '../lib/ledger.js';

describe('relativeLedgerPath', () => {
    it('returns a slash path under the scan root', () => {
        assert.equal(
            relativeLedgerPath('/archives/media', '/archives/media/1998/tape3/MOV001.MOD'),
            '1998/tape3/MOV001.MOD',
        );
    });

    it('returns an absolute slash path when the file is outside the root', () => {
        const rel = relativeLedgerPath('/archives/media', '/converted/MOV001.mp4');
        assert.equal(rel.includes('\\'), false);
        assert.ok(rel.endsWith('/converted/MOV001.mp4'));
    });
});

describe('resolveLedgerDate', () => {
    it('prefers embedded creation_time', () => {
        const hit = resolveLedgerDate(
            { creation_time: '1998-07-04T12:30:00Z', modified_time: '2020-01-01T00:00:00.000Z' },
            '/tape/clip.avi',
        );
        assert.deepEqual(hit, { sourceDate: '1998-07-04T12:30:00', dateSource: 'embedded' });
    });

    it('reads a filename date when tags have none', () => {
        const hit = resolveLedgerDate(
            { creation_time: 'N/A', modified_time: '2020-01-01T00:00:00.000Z' },
            '/tape/2013-01-31_17-45-48_clip.avi',
        );
        assert.equal(hit.dateSource, 'filename');
        assert.equal(hit.sourceDate, '2013-01-31T17:45:48');
    });

    it('treats an MTIME_ filename as filesystem', () => {
        const hit = resolveLedgerDate(
            { creation_time: 'N/A', modified_time: '2020-01-01T00:00:00.000Z' },
            '/tape/MTIME_2010-09-24_10-00-00_clip.avi',
        );
        assert.equal(hit.dateSource, 'filesystem');
        assert.equal(hit.sourceDate, '2010-09-24T10:00:00');
    });

    it('falls back to mtime, and prefer-mtime skips filename', () => {
        const meta = { creation_time: 'N/A', modified_time: '2020-01-01T00:00:00.000Z' };
        const fsHit = resolveLedgerDate(meta, '/tape/clip.avi');
        assert.deepEqual(fsHit, { sourceDate: '2020-01-01T00:00:00', dateSource: 'filesystem' });

        const prefer = resolveLedgerDate(meta, '/tape/2013-01-31_17-45-48_clip.avi', { preferMtime: true });
        assert.equal(prefer.dateSource, 'filesystem');
        assert.equal(prefer.sourceDate, '2020-01-01T00:00:00');
    });
});

describe('isoFromParsed', () => {
    it('omits a clock when the date has none', () => {
        assert.equal(isoFromParsed({
            year: '2010', month: '09', day: '24',
            hour: '00', minute: '00', second: '00', hasTime: false,
        }), '2010-09-24');
    });
});

describe('buildLedgerRecord + comment', () => {
    it('builds a compact provenance record', () => {
        const record = buildLedgerRecord({
            input: '/archives/media/1998/tape3/MOV001.MOD',
            out: '/archives/media/1998/tape3/MOV001.mp4',
            meta: {
                creation_time: '1998-07-04T12:30:00Z',
                modified_time: '2020-01-01T00:00:00.000Z',
            },
            mode: 'video',
            sourceRoot: '/archives/media',
            mediatunaVersion: '1.22.0',
            verified: true,
            durationDeltaMs: 12,
            processedAt: '2026-08-23T16:00:00.000Z',
        });
        assert.deepEqual(record, {
            source: '1998/tape3/MOV001.MOD',
            sourceFormat: 'mod',
            sourceDate: '1998-07-04T12:30:00',
            dateSource: 'embedded',
            action: 'transcode',
            output: '1998/tape3/MOV001.mp4',
            verified: true,
            durationDeltaMs: 12,
            processedAt: '2026-08-23T16:00:00.000Z',
            mediatunaVersion: '1.22.0',
        });
        assert.match(formatLedgerComment(record), /MediaTuna 1\.22\.0 transcode 1998\/tape3\/MOV001\.MOD → MOV001\.mp4/);
    });

    it('marks extract jobs separately', () => {
        const record = buildLedgerRecord({
            input: '/tape/clip.avi',
            out: '/tape/clip.mp3',
            meta: { creation_time: 'N/A' },
            mode: 'extract',
            sourceRoot: '/tape',
            mediatunaVersion: '1.22.0',
        });
        assert.equal(record.action, 'extract');
        assert.equal(record.sourceFormat, 'avi');
    });
});

describe('buildLedgerRemuxArgs', () => {
    const record = {
        source: 'clip.avi',
        action: 'transcode',
        output: 'clip.mp4',
        mediatunaVersion: '1.22.0',
        sourceDate: '1998-07-04T12:30:00',
    };

    it('writes MP4 tags without clobbering streams', () => {
        const args = buildLedgerRemuxArgs('in.mp4', 'tmp.mp4', record, { video: true });
        assert.ok(args.includes('-c'));
        assert.equal(args[args.indexOf('-c') + 1], 'copy');
        assert.ok(args.includes('+faststart+use_metadata_tags'));
        assert.ok(args.some((a) => a.startsWith('comment=MediaTuna')));
        assert.ok(args.some((a) => a.startsWith('mediatuna={') && a.includes('"source":"clip.avi"')));
        assert.ok(!args.includes('-metadata:s:v'));
    });

    it('writes ID3v2 on MP3 remux', () => {
        const args = buildLedgerRemuxArgs('in.mp3', 'tmp.mp3', { ...record, output: 'clip.mp3' }, { video: false });
        assert.ok(args.includes('-id3v2_version'));
        assert.ok(args.includes('3'));
    });
});

describe('defaultLedgerJsonPath', () => {
    it('nests under --output when present', () => {
        assert.equal(
            defaultLedgerJsonPath({ outputDir: '/converted', cwd: '/work' }),
            path.join('/converted', '.mediatuna', 'archive.json'),
        );
    });

    it('uses cwd when converting in place', () => {
        assert.equal(
            defaultLedgerJsonPath({ outputDir: null, cwd: '/work' }),
            path.join('/work', '.mediatuna', 'archive.json'),
        );
    });
});

describe('upsertLedgerSidecar', () => {
    it('appends and replaces by output path', () => {
        resetSidecarQueue();
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediatuna-ledger-'));
        const file = path.join(dir, 'archive.json');
        const first = {
            source: 'a.avi',
            output: 'a.mp4',
            processedAt: '2026-01-01T00:00:00.000Z',
            action: 'transcode',
        };
        const extract = {
            source: 'a.avi',
            output: 'a.mp3',
            processedAt: '2026-01-01T00:00:01.000Z',
            action: 'extract',
        };
        upsertLedgerSidecar(file, first);
        upsertLedgerSidecar(file, extract);
        upsertLedgerSidecar(file, { ...first, verified: true, processedAt: '2026-01-01T00:00:02.000Z' });
        const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
        assert.equal(doc.version, 1);
        assert.equal(doc.entries.length, 2);
        assert.equal(doc.entries[0].verified, true);
        assert.equal(doc.entries[1].action, 'extract');
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

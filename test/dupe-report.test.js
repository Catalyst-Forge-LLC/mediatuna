import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    classifyHits,
    formatDupeReportLines,
    runDupeReport,
} from '../lib/dupe-report.js';

describe('classifyHits', () => {
    it('drops the source path and splits name+size from size-only', () => {
        const input = 'C:\\inbox\\note.mp3';
        const classified = classifyHits(input, [
            { path: 'C:\\inbox\\note.mp3', size: 10 },
            { path: 'Z:\\archive\\note.mp3', size: 10 },
        ], [
            { path: 'C:\\inbox\\note.mp3', size: 10 },
            { path: 'Z:\\archive\\note.mp3', size: 10 },
            { path: 'Z:\\old\\Recording.mp3', size: 10 },
            { path: 'E:\\previews\\thumb.jpg', size: 10 },
        ]);
        assert.deepEqual(classified.sameNameAndSize.map(h => h.path), ['Z:\\archive\\note.mp3']);
        assert.deepEqual(classified.sizeOnly.map(h => h.path), ['Z:\\old\\Recording.mp3']);
    });
});

describe('formatDupeReportLines', () => {
    it('groups name+size, size-only, and unique files', () => {
        const lines = formatDupeReportLines({
            folder: 'C:\\inbox',
            everythingVersion: '1.5.0.1422',
            hashEnabled: false,
            rows: [
                {
                    input: 'C:\\inbox\\keep.mp3',
                    size: 100,
                    sameNameAndSize: [{ path: 'Z:\\copy\\keep.mp3' }],
                    sizeOnly: [],
                    error: null,
                },
                {
                    input: 'C:\\inbox\\renamed.mp3',
                    size: 200,
                    sameNameAndSize: [],
                    sizeOnly: [{ path: 'Z:\\old\\old-name.mp3' }],
                    error: null,
                },
                {
                    input: 'C:\\inbox\\alone.mp3',
                    size: 50,
                    sameNameAndSize: [],
                    sizeOnly: [],
                    error: null,
                },
            ],
        });
        const text = lines.join('\n');
        assert.match(text, /name\+size copies: 1 {2}size-only: 1 {2}unique: 1/);
        assert.match(text, /## Same name and size \(not hashed\)/);
        assert.match(text, /Z:\\copy\\keep\.mp3/);
        assert.match(text, /same extension/);
        assert.match(text, /## No other copies found/);
    });
});

describe('runDupeReport', () => {
    it('queries Everything and writes a report', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-dupe-'));
        const input = path.join(dir, 'note.mp3');
        fs.writeFileSync(input, 'clip');
        const queries = [];
        const { stats, reportPath, lines } = await runDupeReport({
            files: [input],
            rootDir: dir,
            detectFn: () => ({
                esPath: 'es.exe',
                instance: null,
                version: { raw: '1.4.1.1028', major: 1, minor: 4, patch: 1, build: 1028 },
            }),
            searchFn: (query) => {
                queries.push(query);
                const text = Array.isArray(query) ? query.join(' ') : String(query);
                if (text.includes('nopath:exact:')) {
                    return [
                        { path: input, size: 4 },
                        { path: 'Z:\\archive\\note.mp3', size: 4 },
                    ];
                }
                return [
                    { path: input, size: 4 },
                    { path: 'Z:\\archive\\note.mp3', size: 4 },
                    { path: 'Z:\\old\\other.mp3', size: 4 },
                ];
            },
            writeFileFn: () => {},
        });
        assert.equal(stats.nameCopies, 1);
        assert.equal(reportPath, path.join(dir, 'mediatuna-dupe-report.txt'));
        assert.ok(queries[0].some(term => term.includes('nopath:exact:')));
        assert.ok(lines.some(l => l.includes('Z:\\archive\\note.mp3')));
        fs.rmSync(dir, { recursive: true });
    });
});

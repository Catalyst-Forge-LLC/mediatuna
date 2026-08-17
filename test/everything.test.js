import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildNameSizeQuery,
    buildSizeHashQuery,
    isEverything15,
    parseEsCsv,
    parseEverythingVersion,
    quoteEverythingTerm,
    resolveEsPath,
} from '../lib/everything.js';

describe('parseEverythingVersion / isEverything15', () => {
    it('parses 1.4 and 1.5 versions', () => {
        assert.deepEqual(parseEverythingVersion('1.4.1.1028'), {
            raw: '1.4.1.1028', major: 1, minor: 4, patch: 1, build: 1028,
        });
        assert.equal(isEverything15('1.4.1.1028'), false);
        assert.equal(isEverything15('1.5.0.1422'), true);
    });
});

describe('Everything query helpers', () => {
    it('quotes names and builds name+size / hash queries', () => {
        assert.equal(quoteEverythingTerm('clip.mp3'), '"clip.mp3"');
        assert.equal(
            buildNameSizeQuery('2010-09-24-Recording011.mp3', 1663038),
            'size:1663038 nopath:exact:"2010-09-24-Recording011.mp3"',
        );
        assert.equal(buildSizeHashQuery(100, 'AbC'), 'size:100 sha256:abc');
    });
});

describe('parseEsCsv', () => {
    it('reads size and quoted paths', () => {
        const hits = parseEsCsv('1663038,"C:\\inbox\\2010-09-24-Recording011.mp3"\n');
        assert.deepEqual(hits, [{
            size: 1663038,
            path: 'C:\\inbox\\2010-09-24-Recording011.mp3',
        }]);
    });
});

describe('resolveEsPath', () => {
    it('prefers MEDIATUNA_ES when the file exists', () => {
        const found = resolveEsPath({
            env: { MEDIATUNA_ES: 'Z:\\tools\\es.exe' },
            existsFn: (p) => p === 'Z:\\tools\\es.exe',
        });
        assert.equal(found, 'Z:\\tools\\es.exe');
    });
});

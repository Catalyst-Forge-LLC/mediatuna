import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTagKey, extractTagInfo, findTagValue, hasDateTag } from '../lib/tags.js';

describe('normalizeTagKey', () => {
    it('strips namespace prefix', () => {
        assert.equal(normalizeTagKey('ID3v2:TIT2'), 'tit2');
        assert.equal(normalizeTagKey('date'), 'date');
    });
});

describe('extractTagInfo', () => {
    it('counts non-empty tags', () => {
        const info = extractTagInfo({ title: 'A', empty: '  ', skip: null });
        assert.equal(info.tagCount, 1);
        assert.deepEqual(info.tagKeys, ['title']);
    });
});

describe('findTagValue', () => {
    it('finds namespaced keys', () => {
        assert.equal(findTagValue({ 'ID3v2:TPE1': 'Artist' }, 'artist'), null);
        assert.equal(findTagValue({ artist: 'Artist' }, 'artist'), 'Artist');
    });
});

describe('hasDateTag', () => {
    it('detects date tags', () => {
        assert.equal(hasDateTag({ date: '2020' }), true);
        assert.equal(hasDateTag({ title: 'x' }), false);
        assert.equal(hasDateTag({ date: 'N/A' }), false);
    });
});

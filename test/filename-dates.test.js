import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseFilenameDate,
    normalizeDatedBasename,
    isStandardDatedName,
} from '../lib/filename-dates.js';

describe('parseFilenameDate / normalizeDatedBasename', () => {
    it('normalizes yy-mm-dd-hh-mm-ss voice-recorder names', () => {
        assert.equal(normalizeDatedBasename('16-05-24-17-19-01.wav'), '2016-05-24_171901.wav');
        assert.equal(normalizeDatedBasename('15-09-11-07-57-57-2.wav'), '2015-09-11_075757_2.wav');
        assert.equal(normalizeDatedBasename('17-09-14-08-57-13-clean.wav'), '2017-09-14_085713_clean.wav');
    });

    it('normalizes VR_, AudioNote, and underscore dates', () => {
        assert.equal(normalizeDatedBasename('VR_2017-10-12_20-31-29.wav'), '2017-10-12_203129.wav');
        assert.equal(normalizeDatedBasename('AudioNote-2011-09-20_100334.amr'), '2011-09-20_100334.amr');
        assert.equal(normalizeDatedBasename('2017_10_12_20_33_04.wav'), '2017-10-12_203304.wav');
    });

    it('leaves already-standard and MTIME_ names alone', () => {
        assert.equal(normalizeDatedBasename('2016-05-24_171901.wav'), '2016-05-24_171901.wav');
        assert.equal(normalizeDatedBasename('MTIME_2018-12-24_200148_REC_0005.aac'), 'MTIME_2018-12-24_200148_REC_0005.aac');
        assert.equal(isStandardDatedName('MTIME_2018-12-24_200148_REC_0005.aac'), true);
        assert.equal(isStandardDatedName('16-05-24-17-19-01.wav'), false);
    });

    it('returns null for names with no date', () => {
        assert.equal(parseFilenameDate('REC_0005.aac'), null);
        assert.equal(normalizeDatedBasename('REC_0005.aac'), 'REC_0005.aac');
    });
});

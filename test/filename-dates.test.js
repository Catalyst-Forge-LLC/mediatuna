import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseFilenameDate,
    normalizeDatedBasename,
    isStandardDatedName,
} from '../lib/filename-dates.js';

describe('parseFilenameDate / normalizeDatedBasename', () => {
    it('normalizes yy-mm-dd-hh-mm-ss voice-recorder names', () => {
        assert.equal(normalizeDatedBasename('16-05-24-17-19-01.wav'), '2016-05-24_17-19-01.wav');
        assert.equal(normalizeDatedBasename('15-09-11-07-57-57-2.wav'), '2015-09-11_07-57-57_2.wav');
        assert.equal(normalizeDatedBasename('17-09-14-08-57-13-clean.wav'), '2017-09-14_08-57-13_clean.wav');
    });

    it('normalizes VR_, AudioNote, and underscore dates', () => {
        assert.equal(normalizeDatedBasename('VR_2017-10-12_20-31-29.wav'), '2017-10-12_20-31-29.wav');
        assert.equal(normalizeDatedBasename('AudioNote-2011-09-20_100334.amr'), '2011-09-20_10-03-34.amr');
        assert.equal(normalizeDatedBasename('2017_10_12_20_33_04.wav'), '2017-10-12_20-33-04.wav');
    });

    it('rewrites compact six-digit clocks to HH-MM-SS', () => {
        assert.equal(normalizeDatedBasename('2016-05-24_171901.wav'), '2016-05-24_17-19-01.wav');
        assert.equal(normalizeDatedBasename('2015-09-11_075757_2.wav'), '2015-09-11_07-57-57_2.wav');
        assert.equal(normalizeDatedBasename('MTIME_2018-12-24_200148_REC_0005.aac'), 'MTIME_2018-12-24_20-01-48_REC_0005.aac');
        assert.equal(normalizeDatedBasename('2006-07-27_193222Z_Video010.3g2'), '2006-07-27_19-32-22Z_Video010.3g2');
        assert.equal(isStandardDatedName('2016-05-24_171901.wav'), false);
        assert.equal(isStandardDatedName('2016-05-24_17-19-01.wav'), true);
    });

    it('leaves dashed standard names alone', () => {
        assert.equal(normalizeDatedBasename('2016-05-24_17-19-01.wav'), '2016-05-24_17-19-01.wav');
        assert.equal(normalizeDatedBasename('MTIME_2018-12-24_20-01-48_REC_0005.aac'), 'MTIME_2018-12-24_20-01-48_REC_0005.aac');
        assert.equal(isStandardDatedName('16-05-24-17-19-01.wav'), false);
    });

    it('normalizes YYYY-MM-DD-HH-MM-SS all-dash names', () => {
        assert.equal(normalizeDatedBasename('2013-01-31-17-45-48.mp3'), '2013-01-31_17-45-48.mp3');
        assert.equal(normalizeDatedBasename('2012-06-15-10-30-00.mp3'), '2012-06-15_10-30-00.mp3');
        assert.equal(normalizeDatedBasename('2013-01-31-17-45-48-clean.mp3'), '2013-01-31_17-45-48_clean.mp3');
    });

    it('normalizes YYYYMMDD HHMMSS voice-memo names', () => {
        assert.equal(normalizeDatedBasename('20130326 194851.m4a'), '2013-03-26_19-48-51.m4a');
        assert.equal(normalizeDatedBasename('20130326_194851.m4a'), '2013-03-26_19-48-51.m4a');
        assert.equal(normalizeDatedBasename('20130326-194851 extra.m4a'), '2013-03-26_19-48-51_extra.m4a');
        assert.equal(parseFilenameDate('20131326 194851.m4a'), null);
    });

    it('returns null for names with no date', () => {
        assert.equal(parseFilenameDate('REC_0005.aac'), null);
        assert.equal(normalizeDatedBasename('REC_0005.aac'), 'REC_0005.aac');
    });
});

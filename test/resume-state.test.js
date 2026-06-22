import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    applyResumeToPreflight,
    buildRunKey,
    createResumeState,
    defaultStatePath,
    entryNeedsWork,
    isMarkedCompleted,
    loadResumeState,
    markCompleted,
    saveResumeState,
    shouldSkipResumed,
} from '../lib/resume-state.js';

const mediaMode = { video: true, audio: true };

function sampleEntry(overrides = {}) {
    return {
        input: '/archive/clip.avi',
        out: '/archive/clip.mp4',
        audioOut: '/archive/clip.mp3',
        meta: { mediaType: 'video', duration: 120 },
        videoStatus: 'convert → mp4',
        extractStatus: 'convert → mp3 [extract]',
        status: 'convert → mp4 + mp3 extract',
        ...overrides,
    };
}

describe('buildRunKey', () => {
    it('serializes run options deterministically', () => {
        const key = buildRunKey({
            outputDir: '/out',
            quality: 'medium',
            audioQuality: 'fast',
            deinterlace: 'auto',
            mediaMode: { video: true, audio: false },
            extractAudio: true,
            verify: true,
        });
        assert.equal(key, JSON.stringify({
            outputDir: '/out',
            quality: 'medium',
            audioQuality: 'fast',
            deinterlace: 'auto',
            video: true,
            audio: false,
            extractAudio: true,
            verify: true,
        }));
    });
});

describe('resume state persistence', () => {
    it('round-trips completed inputs through save/load', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediatuna-resume-'));
        const statePath = path.join(dir, '.mediatuna-state.json');
        const runKey = buildRunKey({
            outputDir: null,
            quality: 'medium',
            audioQuality: 'medium',
            deinterlace: 'auto',
            mediaMode,
            extractAudio: false,
            verify: true,
        });
        const state = createResumeState(runKey);
        markCompleted(state, '/archive/a.avi');
        markCompleted(state, '/archive/b.avi');
        saveResumeState(statePath, state);

        const loaded = loadResumeState(statePath);
        assert.ok(loaded);
        assert.equal(loaded.runKey, runKey);
        assert.ok(isMarkedCompleted(loaded, '/archive/a.avi'));
        assert.ok(isMarkedCompleted(loaded, '/archive/b.avi'));
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('defaultStatePath sits next to the log file', () => {
        assert.equal(
            defaultStatePath('/logs/run/mediatuna-log.txt'),
            path.join('/logs/run', '.mediatuna-state.json'),
        );
    });
});

describe('entryNeedsWork', () => {
    it('detects pending video or extract jobs', () => {
        assert.equal(entryNeedsWork(sampleEntry(), mediaMode, true), true);
        assert.equal(entryNeedsWork(sampleEntry({ extractStatus: null }), mediaMode, false), true);
        assert.equal(
            entryNeedsWork(sampleEntry({ videoStatus: 'skip (exists)', extractStatus: null }), mediaMode, false),
            false,
        );
        assert.equal(
            entryNeedsWork(
                sampleEntry({ videoStatus: 'skip (exists)', extractStatus: 'convert → mp3 [extract]' }),
                mediaMode,
                true,
            ),
            true,
        );
    });
});

describe('shouldSkipResumed', () => {
    it('skips when marked complete and outputs verify', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediatuna-resume-'));
        const out = path.join(dir, 'clip.mp4');
        const audioOut = path.join(dir, 'clip.mp3');
        fs.writeFileSync(out, 'video');
        fs.writeFileSync(audioOut, 'audio');

        const state = createResumeState('key');
        markCompleted(state, '/archive/clip.avi');
        const entry = sampleEntry({ input: '/archive/clip.avi', out, audioOut });
        const verifyOutputFn = () => ({ ok: true });

        assert.equal(
            shouldSkipResumed(entry, state, { mediaMode, extractAudio: true, verifyOutputFn }),
            true,
        );
        assert.equal(
            shouldSkipResumed(entry, state, { mediaMode, extractAudio: true, verifyOutputFn, force: true }),
            false,
        );
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('does not skip when extract output is missing', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediatuna-resume-'));
        const out = path.join(dir, 'clip.mp4');
        fs.writeFileSync(out, 'video');

        const state = createResumeState('key');
        markCompleted(state, '/archive/clip.avi');
        const entry = sampleEntry({
            input: '/archive/clip.avi',
            out,
            audioOut: path.join(dir, 'clip.mp3'),
        });

        assert.equal(
            shouldSkipResumed(entry, state, {
                mediaMode,
                extractAudio: true,
                verifyOutputFn: () => ({ ok: true }),
            }),
            false,
        );
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('applyResumeToPreflight', () => {
    it('marks convert statuses as skip (resumed)', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediatuna-resume-'));
        const out = path.join(dir, 'clip.mp4');
        const audioOut = path.join(dir, 'clip.mp3');
        fs.writeFileSync(out, 'video');
        fs.writeFileSync(audioOut, 'audio');

        const state = createResumeState('key');
        markCompleted(state, '/archive/clip.avi');
        const entry = sampleEntry({ input: '/archive/clip.avi', out, audioOut });
        const verifyOutputFn = () => ({ ok: true });

        const { entries, resumed } = applyResumeToPreflight([entry], state, {
            resume: true,
            mediaMode,
            extractAudio: true,
            verifyOutputFn,
        });

        assert.equal(resumed, 1);
        assert.equal(entries[0].videoStatus, 'skip (resumed)');
        assert.equal(entries[0].extractStatus, 'skip (resumed)');
        assert.match(entries[0].status, /skip \(resumed\)/);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('is a no-op without --resume', () => {
        const state = createResumeState('key');
        markCompleted(state, '/archive/clip.avi');
        const entry = sampleEntry({ input: '/archive/clip.avi' });
        const { entries, resumed } = applyResumeToPreflight([entry], state, {
            resume: false,
            mediaMode,
            extractAudio: true,
            verifyOutputFn: () => ({ ok: true }),
        });
        assert.equal(resumed, 0);
        assert.equal(entries[0].videoStatus, 'convert → mp4');
    });
});

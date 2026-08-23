import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    convertArgs,
    probeDuration,
    runMediatuna,
    shouldRunFfmpegTests,
    writeLavfiVideo,
    writeTaggedMp3,
} from '../helpers/ffmpeg.js';

const enabled = shouldRunFfmpegTests();

function makeWorkspace(prefix) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    const inbox = path.join(root, 'inbox');
    const out = path.join(root, 'out');
    fs.mkdirSync(inbox);
    fs.mkdirSync(out);
    return { root, inbox, out };
}

describe('ffmpeg integration', { skip: !enabled }, () => {
    it('TS-10: --sample 2 writes *.sample.mp4 only', { timeout: 60_000 }, () => {
        const { root, inbox, out } = makeWorkspace('mediatuna-ts10-');
        const source = path.join(inbox, 'clip.avi');
        writeLavfiVideo(source, { seconds: 5 });

        const result = runMediatuna(convertArgs([
            inbox, '--sample', '2', '--output', out, '--video-only',
        ], { cwd: root }), { cwd: root });

        assert.equal(result.status, 0, result.stderr || result.stdout);
        const sample = path.join(out, 'clip.sample.mp4');
        assert.ok(fs.existsSync(sample), 'expected clip.sample.mp4');
        assert.ok(!fs.existsSync(path.join(out, 'clip.mp4')), 'must not write a full clip.mp4');
        assert.ok(!fs.existsSync(path.join(inbox, 'clip.mp4')));
        const duration = probeDuration(sample);
        assert.ok(duration > 1.2 && duration < 3.2, `sample duration was ${duration}`);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('TS-12: empty existing .mp4 is re-encoded', { timeout: 60_000 }, () => {
        const { root, inbox, out } = makeWorkspace('mediatuna-ts12-');
        const source = path.join(inbox, 'clip.avi');
        writeLavfiVideo(source, { seconds: 5 });
        const dest = path.join(out, 'clip.mp4');
        fs.writeFileSync(dest, '');

        const result = runMediatuna(convertArgs([
            inbox, '--output', out, '--video-only',
        ], { cwd: root }), { cwd: root });

        assert.equal(result.status, 0, result.stderr || result.stdout);
        const stat = fs.statSync(dest);
        assert.ok(stat.size > 1000, `dest stayed tiny (${stat.size} bytes)`);
        const duration = probeDuration(dest);
        assert.ok(duration > 4 && duration < 7, `converted duration was ${duration}`);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('TS-11: full convert then --verify', { timeout: 60_000 }, () => {
        const { root, inbox, out } = makeWorkspace('mediatuna-ts11-');
        const source = path.join(inbox, 'clip.avi');
        writeLavfiVideo(source, { seconds: 5 });

        const result = runMediatuna(convertArgs([
            inbox, '--output', out, '--video-only',
        ], { cwd: root }), { cwd: root });

        assert.equal(result.status, 0, result.stderr || result.stdout);
        const dest = path.join(out, 'clip.mp4');
        assert.ok(fs.existsSync(dest));
        const duration = probeDuration(dest);
        assert.ok(duration > 4 && duration < 7, `verified duration was ${duration}`);
        const log = fs.readFileSync(path.join(root, 'mediatuna-log.txt'), 'utf8');
        assert.match(log, /Verified/);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('TS-13: tagged MP3 above the floor is skip (normalized)', { timeout: 60_000 }, () => {
        const { root, inbox, out } = makeWorkspace('mediatuna-ts13-');
        const source = path.join(inbox, 'clip.mp3');
        writeTaggedMp3(source, { seconds: 3 });

        const first = runMediatuna(convertArgs([
            inbox, '--output', out, '--audio-only',
        ], { cwd: root, logName: 'first.txt' }), { cwd: root });
        assert.equal(first.status, 0, first.stderr || first.stdout);
        const dest = path.join(out, 'clip.mp3');
        assert.ok(fs.existsSync(dest));
        const before = fs.statSync(dest);

        const second = runMediatuna(convertArgs([
            inbox, '--output', out, '--audio-only',
        ], { cwd: root, logName: 'second.txt' }), { cwd: root });
        assert.equal(second.status, 0, second.stderr || second.stdout);
        const log = fs.readFileSync(path.join(root, 'second.txt'), 'utf8');
        assert.match(log, /skip \(normalized\)|Skipped \(normalized\)/);
        const after = fs.statSync(dest);
        assert.equal(after.mtimeMs, before.mtimeMs);
        assert.equal(after.size, before.size);
        fs.rmSync(root, { recursive: true, force: true });
    });
});

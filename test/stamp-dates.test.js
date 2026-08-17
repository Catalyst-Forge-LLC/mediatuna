import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    parseCreationDate,
    formatStampPrefix,
    existingStampPrefix,
    buildStampedName,
    resolveStampDate,
    stampedOutputStem,
    planStampRenames,
    applyStampPlan,
    formatStampPlanLines,
} from '../lib/stamp-dates.js';

describe('parseCreationDate', () => {
    it('parses ffprobe creation_time', () => {
        const parsed = parseCreationDate('2006-07-27T19:32:22.000000Z');
        assert.deepEqual(parsed, {
            year: '2006', month: '07', day: '27',
            hour: '19', minute: '32', second: '22',
            hasTime: true,
        });
    });

    it('parses date-only values', () => {
        const parsed = parseCreationDate('2006-07-27');
        assert.equal(parsed.hasTime, false);
        assert.equal(parsed.year, '2006');
        assert.equal(parsed.day, '27');
    });

    it('rejects missing, N/A, and year-only tags', () => {
        assert.equal(parseCreationDate(null), null);
        assert.equal(parseCreationDate('N/A'), null);
        assert.equal(parseCreationDate('2006'), null);
        assert.equal(parseCreationDate(''), null);
    });
});

describe('formatStampPrefix / buildStampedName', () => {
    it('encodes UTC date and time', () => {
        assert.equal(
            formatStampPrefix(parseCreationDate('2006-07-27T19:32:22.000000Z')),
            '2006-07-27_19-32-22Z',
        );
    });

    it('omits time when the tag has no clock', () => {
        assert.equal(formatStampPrefix(parseCreationDate('2006-07-27')), '2006-07-27');
    });

    it('prefixes the original basename once', () => {
        assert.equal(buildStampedName('Video010.3g2', '2006-07-27_19-32-22Z'), '2006-07-27_19-32-22Z_Video010.3g2');
        assert.equal(buildStampedName('2006-07-27_19-32-22Z_Video010.3g2', '2006-07-27_19-32-22Z'), '2006-07-27_19-32-22Z_Video010.3g2');
        assert.equal(buildStampedName('2006-07-16_08-15-20Z_Video000.3g2', '2006-07-27_19-32-22Z'), null);
    });

    it('detects an existing stamp prefix', () => {
        assert.equal(existingStampPrefix('2006-07-27_19-32-22Z_Video010.3g2'), '2006-07-27_19-32-22Z');
        assert.equal(existingStampPrefix('MTIME_2018-12-24_20-01-48_REC_0005.aac'), 'MTIME_2018-12-24_20-01-48');
        assert.equal(existingStampPrefix('Video010.3g2'), null);
    });

    it('marks filesystem dates with an MTIME_ prefix', () => {
        const parsed = parseCreationDate('2018-12-24T20:01:48.000Z');
        assert.equal(formatStampPrefix(parsed, { source: 'mtime' }), 'MTIME_2018-12-24_20-01-48');
        assert.equal(formatStampPrefix(parsed, { source: 'creation_time' }), '2018-12-24_20-01-48Z');
    });
});

describe('stampedOutputStem', () => {
    it('adds a prefix only when the name has none', () => {
        assert.equal(
            stampedOutputStem('Video010.3g2', { creation_time: '2006-07-27T19:32:22.000000Z' }),
            '2006-07-27_19-32-22Z_Video010',
        );
    });

    it('rewrites a compact existing prefix to dashed clock', () => {
        assert.equal(
            stampedOutputStem('2006-07-27_193222Z_Video010.3g2', { creation_time: '2006-08-08T19:26:20.000000Z' }),
            '2006-07-27_19-32-22Z_Video010',
        );
    });

    it('does not replace an existing prefix', () => {
        assert.equal(
            stampedOutputStem('2006-07-27_19-32-22Z_Video010.3g2', { creation_time: '2006-08-08T19:26:20.000000Z' }),
            '2006-07-27_19-32-22Z_Video010',
        );
    });

    it('leaves the stem alone when there is no parseable date', () => {
        assert.equal(stampedOutputStem('Video010.3g2', { creation_time: 'N/A' }), 'Video010');
    });

    it('uses an MTIME_ prefix when falling back to file date', () => {
        const stem = stampedOutputStem('REC_0005.aac', {
            creation_time: 'N/A',
            modified_time: '2018-12-24T20:01:48.000Z',
        }, { preferMtime: true });
        assert.match(stem, /^MTIME_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_REC_0005$/);
    });
});

describe('resolveStampDate', () => {
    it('prefers container creation_time', () => {
        const resolved = resolveStampDate({
            creation_time: '2006-07-27T19:32:22.000000Z',
            modified_time: '2006-07-27T22:35:20.000Z',
        });
        assert.equal(resolved.source, 'creation_time');
        assert.equal(formatStampPrefix(resolved.parsed), '2006-07-27_19-32-22Z');
    });

    it('falls back to mtime only when asked', () => {
        const meta = { creation_time: 'N/A', modified_time: '2006-07-27T22:35:20.000Z' };
        assert.equal(resolveStampDate(meta).parsed, null);
        const withMtime = resolveStampDate(meta, { preferMtime: true });
        assert.equal(withMtime.source, 'mtime');
        const prefix = formatStampPrefix(withMtime.parsed, { source: 'mtime' });
        assert.match(prefix, /^MTIME_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
        const dt = new Date(meta.modified_time);
        const local = [
            String(dt.getFullYear()).padStart(4, '0'),
            String(dt.getMonth() + 1).padStart(2, '0'),
            String(dt.getDate()).padStart(2, '0'),
        ].join('-');
        assert.ok(prefix.startsWith(`MTIME_${local}`));
    });
});

describe('planStampRenames + applyStampPlan', () => {
    it('plans a rename from probe metadata', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-stamp-'));
        const input = path.join(dir, 'Video010.3g2');
        fs.writeFileSync(input, 'clip');
        const { plans, stats } = planStampRenames([input], {
            probeFn: () => ({
                creation_time: '2006-07-27T19:32:22.000000Z',
                modified_time: '2006-07-27T22:35:20.000Z',
            }),
        });
        assert.equal(stats.rename, 1);
        assert.equal(plans[0].action, 'rename');
        assert.equal(path.basename(plans[0].output), '2006-07-27_19-32-22Z_Video010.3g2');
        fs.rmSync(dir, { recursive: true });
    });

    it('rewrites yy-mm-dd filename dates to the standard form', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-stamp-'));
        const input = path.join(dir, '16-05-24-17-19-01.wav');
        fs.writeFileSync(input, 'note');
        const { plans } = planStampRenames([input], {
            probeFn: () => ({ creation_time: 'N/A' }),
        });
        assert.equal(plans[0].action, 'rename');
        assert.equal(plans[0].source, 'filename');
        assert.equal(path.basename(plans[0].output), '2016-05-24_17-19-01.wav');
        fs.rmSync(dir, { recursive: true });
    });

    it('puts an underscore after a date-only filename prefix', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-stamp-'));
        const input = path.join(dir, '2010-09-24-Recording011.mp3');
        fs.writeFileSync(input, 'note');
        const { plans } = planStampRenames([input], {
            probeFn: () => ({ creation_time: 'N/A' }),
        });
        assert.equal(plans[0].action, 'rename');
        assert.equal(plans[0].source, 'filename');
        assert.equal(path.basename(plans[0].output), '2010-09-24_Recording011.mp3');
        fs.rmSync(dir, { recursive: true });
    });

    it('rewrites compact six-digit clocks to HH-MM-SS', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-stamp-'));
        const input = path.join(dir, '2016-05-24_171901.wav');
        fs.writeFileSync(input, 'note');
        const { plans } = planStampRenames([input], {
            probeFn: () => ({ creation_time: 'N/A' }),
        });
        assert.equal(plans[0].action, 'rename');
        assert.equal(plans[0].source, 'filename');
        assert.equal(path.basename(plans[0].output), '2016-05-24_17-19-01.wav');
        fs.rmSync(dir, { recursive: true });
    });

    it('skips files that are already stamped', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-stamp-'));
        const input = path.join(dir, '2006-07-27_19-32-22Z_Video010.3g2');
        fs.writeFileSync(input, 'clip');
        const { plans } = planStampRenames([input], {
            probeFn: () => ({ creation_time: '2006-07-27T19:32:22.000000Z' }),
        });
        assert.equal(plans[0].action, 'skip');
        assert.equal(plans[0].reason, 'already stamped');
        fs.rmSync(dir, { recursive: true });
    });

    it('does not overwrite an existing destination', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-stamp-'));
        const input = path.join(dir, 'Video010.3g2');
        const dest = path.join(dir, '2006-07-27_19-32-22Z_Video010.3g2');
        fs.writeFileSync(input, 'src');
        fs.writeFileSync(dest, 'existing');
        const { plans } = planStampRenames([input], {
            probeFn: () => ({ creation_time: '2006-07-27T19:32:22.000000Z' }),
        });
        assert.equal(plans[0].action, 'error');
        assert.match(plans[0].reason, /already exists/);
        fs.rmSync(dir, { recursive: true });
    });

    it('backs up then renames, and dry-run changes nothing', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-stamp-'));
        const backupDir = path.join(dir, 'backup');
        const input = path.join(dir, 'Video010.3g2');
        fs.writeFileSync(input, 'clip-bytes');
        const { plans } = planStampRenames([input], {
            probeFn: () => ({ creation_time: '2006-07-27T19:32:22.000000Z' }),
            rootDir: dir,
        });

        const dry = applyStampPlan(plans, { dryRun: true, backupDir });
        assert.equal(dry.renamed, 1);
        assert.equal(fs.existsSync(input), true);
        assert.equal(fs.existsSync(backupDir), false);

        const applied = applyStampPlan(plans, {
            dryRun: false,
            backupDir,
            manifestPath: path.join(backupDir, 'mediatuna-stamp-manifest.json'),
        });
        assert.equal(applied.renamed, 1);
        assert.equal(applied.backedUp, 1);
        assert.equal(fs.existsSync(input), false);
        assert.equal(fs.existsSync(path.join(dir, '2006-07-27_19-32-22Z_Video010.3g2')), true);
        assert.equal(fs.readFileSync(path.join(backupDir, 'Video010.3g2'), 'utf8'), 'clip-bytes');
        const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'mediatuna-stamp-manifest.json'), 'utf8'));
        assert.equal(manifest.renames[0].from, 'Video010.3g2');
        assert.equal(manifest.renames[0].to, '2006-07-27_19-32-22Z_Video010.3g2');
        fs.rmSync(dir, { recursive: true });
    });

    it('formats a preview table', () => {
        const lines = formatStampPlanLines([
            {
                input: '/a/Video010.3g2',
                output: '/a/2006-07-27_19-32-22Z_Video010.3g2',
                action: 'rename',
                source: 'creation_time',
                reason: 'creation_time',
            },
        ], { dryRun: true, backupDir: '/a/backup' });
        assert.ok(lines.some(l => l.includes('would rename')));
        assert.ok(lines.some(l => l.includes('Video010.3g2')));
        assert.ok(lines.some(l => l.includes('Backup:')));
    });
});

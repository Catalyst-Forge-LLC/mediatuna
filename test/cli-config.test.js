import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { parseArgs } from 'node:util';
import { buildCliConfig, CliConfigError, CLI_PARSE_OPTIONS } from '../lib/cli-config.js';

function parseArgv(argv) {
    return parseArgs({
        args: argv,
        options: CLI_PARSE_OPTIONS,
        allowPositionals: true,
        strict: true,
    });
}

describe('buildCliConfig', () => {
    it('defaults to combined video+audio mode', () => {
        const { values, positionals } = parseArgv([]);
        const config = buildCliConfig(values, positionals, { cwd: '/work', homedir: '/home/user' });
        assert.deepEqual(config.mediaMode, { video: true, audio: true });
        assert.equal(config.quality, 'medium');
        assert.equal(config.audioQuality, 'medium');
        assert.equal(config.reencodeAudio, false);
        assert.equal(config.ledger, false);
        assert.equal(config.ledgerJsonPath, null);
        assert.equal(config.logFile, path.join('/work', 'mediatuna-log.txt'));
        assert.equal(config.masterLogFile, path.join('/home/user', '.mediatuna', 'history.log'));
    });

    it('applies audio-only and extract-audio flags', () => {
        const { values, positionals } = parseArgv(['--audio-only', '--prefer-mtime']);
        const config = buildCliConfig(values, positionals);
        assert.deepEqual(config.mediaMode, { video: false, audio: true });
        assert.equal(config.preferMtime, true);
    });

    it('splits audio quality from video quality', () => {
        const { values, positionals } = parseArgv(['--quality', 'high', '--audio-quality', 'fast']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.quality, 'high');
        assert.equal(config.audioQuality, 'fast');
    });

    it('rejects conflicting flags', () => {
        const { values, positionals } = parseArgv(['--recursive', '--flat']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--recursive'),
        );
    });

    it('rejects extract-audio with audio-only', () => {
        const { values, positionals } = parseArgv(['--extract-audio', '--audio-only']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--extract-audio'),
        );
    });

    it('rejects invalid quality', () => {
        const { values, positionals } = parseArgv(['--quality', 'ultra']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('invalid quality'),
        );
    });

    it('accepts a single target path', () => {
        const { values, positionals } = parseArgv(['./archive']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.target, './archive');
    });

    it('enables resume flag', () => {
        const { values, positionals } = parseArgv(['--resume']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.resume, true);
    });

    it('rejects resume with dry-run', () => {
        const { values, positionals } = parseArgv(['--resume', '--dry-run']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--dry-run'),
        );
    });

    it('rejects resume with no-verify', () => {
        const { values, positionals } = parseArgv(['--resume', '--no-verify']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--no-verify'),
        );
    });

    it('accepts --jobs', () => {
        const { values, positionals } = parseArgv(['--jobs', '3']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.jobs, 3);
    });

    it('rejects invalid --jobs', () => {
        const { values, positionals } = parseArgv(['--jobs', '0']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--jobs'),
        );
    });

    it('enables stamp-dates with backup', () => {
        const { values, positionals } = parseArgv(['--stamp-dates', '--backup', './safe']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.stampDates, true);
        assert.equal(config.stampVideo, true);
        assert.equal(config.backupDir, path.resolve('./safe'));
    });

    it('defaults to stamping video output names', () => {
        const { values, positionals } = parseArgv([]);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.stampVideo, true);
        assert.equal(config.stampDates, false);
    });

    it('disables video output stamping', () => {
        const { values, positionals } = parseArgv(['--no-stamp-dates']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.stampVideo, false);
    });

    it('rejects backup without stamp-dates', () => {
        const { values, positionals } = parseArgv(['--backup', './safe']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--stamp-dates'),
        );
    });

    it('rejects stamp-dates with no-stamp-dates', () => {
        const { values, positionals } = parseArgv(['--stamp-dates', '--no-stamp-dates']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--no-stamp-dates'),
        );
    });

    it('rejects stamp-dates with convert-only flags', () => {
        const { values, positionals } = parseArgv(['--stamp-dates', '--resume']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--stamp-dates'),
        );
    });

    it('enables dupe-report with hash', () => {
        const { values, positionals } = parseArgv(['--dupe-report', '--hash']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.dupeReport, true);
        assert.equal(config.dupeHash, true);
    });

    it('enables recup-map with custom extensions', () => {
        const { values, positionals } = parseArgv(['--recup-map', '--ext', 'mp3,wav']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.recupMap, true);
        assert.equal(config.recupExt, 'mp3,wav');
    });

    it('allows cleanup-originals with recup-map', () => {
        const { values, positionals } = parseArgv(['--recup-map', '--cleanup-originals']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.recupMap, true);
        assert.equal(config.cleanupOriginals, true);
    });

    it('rejects hash without dupe-report or recup-map', () => {
        const { values, positionals } = parseArgv(['--hash']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--recup-map'),
        );
    });

    it('allows hash with recup-map', () => {
        const { values, positionals } = parseArgv(['--recup-map', '--hash', '--apply']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.recupMap, true);
        assert.equal(config.dupeHash, true);
        assert.equal(config.recupApply, true);
    });

    it('allows --yes and --delete-permanent with cleanup', () => {
        const { values, positionals } = parseArgv(['--cleanup-originals', '--delete-permanent', '--yes']);
        const config = buildCliConfig(values, positionals);
        assert.equal(config.deletePermanent, true);
        assert.equal(config.yes, true);
    });

    it('accepts archive, sample, and globs', () => {
        const archived = buildCliConfig(
            parseArgv(['--archive', './done', '--include', '*.avi', '--exclude', 'previews']).values,
            [],
        );
        assert.ok(archived.archiveDir.endsWith('done'));
        assert.deepEqual(archived.include, ['*.avi']);
        assert.deepEqual(archived.exclude, ['previews']);
        const sample = buildCliConfig(parseArgv(['--sample', '30']).values, []);
        assert.equal(sample.sampleSeconds, 30);
        assert.equal(sample.reencodeAudio, false);
        const reencode = buildCliConfig(parseArgv(['--reencode-audio']).values, []);
        assert.equal(reencode.reencodeAudio, true);
        assert.throws(
            () => buildCliConfig(parseArgv(['--sample', '15', '--archive', './done']).values, []),
            (err) => err instanceof CliConfigError && err.message.includes('--sample'),
        );
        assert.throws(
            () => buildCliConfig(parseArgv(['--archive', './done', '--delete-originals']).values, []),
            (err) => err instanceof CliConfigError && err.message.includes('--delete-originals'),
        );
        assert.throws(
            () => buildCliConfig(parseArgv(['--sample', '30', '--resume']).values, []),
            (err) => err instanceof CliConfigError && err.message.includes('--resume'),
        );
        assert.throws(
            () => buildCliConfig(parseArgv(['--sample', '0']).values, []),
            (err) => err instanceof CliConfigError && err.message.includes('--sample'),
        );
    });

    it('enables ledger embed and optional json sidecar', () => {
        const embed = buildCliConfig(parseArgv(['--ledger']).values, []);
        assert.equal(embed.ledger, true);
        assert.equal(embed.ledgerJsonPath, null);

        const both = buildCliConfig(
            parseArgv(['--ledger-json', '--output', './converted']).values,
            [],
            { cwd: '/work' },
        );
        assert.equal(both.ledger, true);
        assert.equal(both.ledgerJsonPath, path.join(path.resolve('./converted'), '.mediatuna', 'archive.json'));

        const inPlace = buildCliConfig(parseArgv(['--ledger-json']).values, [], { cwd: '/work' });
        assert.equal(inPlace.ledgerJsonPath, path.join('/work', '.mediatuna', 'archive.json'));
    });

    it('rejects ledger with report and sample modes', () => {
        assert.throws(
            () => buildCliConfig(parseArgv(['--ledger', '--stamp-dates']).values, []),
            (err) => err instanceof CliConfigError && err.message.includes('--stamp-dates'),
        );
        assert.throws(
            () => buildCliConfig(parseArgv(['--ledger-json', '--dupe-report']).values, []),
            (err) => err instanceof CliConfigError && err.message.includes('--dupe-report'),
        );
        assert.throws(
            () => buildCliConfig(parseArgv(['--ledger', '--sample', '20']).values, []),
            (err) => err instanceof CliConfigError && err.message.includes('--sample'),
        );
        assert.throws(
            () => buildCliConfig(parseArgv(['--ledger', '--cleanup-originals']).values, []),
            (err) => err instanceof CliConfigError && err.message.includes('--cleanup-originals'),
        );
        assert.throws(
            () => buildCliConfig(parseArgv(['--ledger', '--recup-map']).values, []),
            (err) => err instanceof CliConfigError && err.message.includes('--recup-map'),
        );
    });

    it('rejects --delete-permanent without a delete flag', () => {
        const { values, positionals } = parseArgv(['--delete-permanent']);
        assert.throws(
            () => buildCliConfig(values, positionals),
            (err) => err instanceof CliConfigError && err.message.includes('--delete-permanent'),
        );
    });
});

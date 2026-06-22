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
});

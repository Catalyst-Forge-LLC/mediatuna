import os from 'os';
import path from 'path';
import { VALID_DEINTERLACE, VALID_QUALITY } from './constants.js';

export class CliConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CliConfigError';
    }
}

export const CLI_PARSE_OPTIONS = {
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'V' },
    force: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
    recursive: { type: 'boolean' },
    flat: { type: 'boolean' },
    output: { type: 'string' },
    log: { type: 'string' },
    'master-log': { type: 'string' },
    'no-master-log': { type: 'boolean' },
    'delete-originals': { type: 'boolean' },
    'cleanup-originals': { type: 'boolean' },
    quality: { type: 'string', default: 'medium' },
    deinterlace: { type: 'string', default: 'auto' },
    'no-verify': { type: 'boolean' },
    'keep-partial': { type: 'boolean' },
    verbose: { type: 'boolean' },
    'video-only': { type: 'boolean' },
    'audio-only': { type: 'boolean' },
    'prefer-mtime': { type: 'boolean' },
    'embed-art': { type: 'boolean' },
    'no-embed-art': { type: 'boolean' },
    'extract-audio': { type: 'boolean' },
    'audio-quality': { type: 'string' },
};

export function buildCliConfig(values, positionals, { cwd = process.cwd(), homedir = os.homedir() } = {}) {
    if (values.recursive && values.flat) {
        throw new CliConfigError('--recursive and --flat cannot be used together.');
    }

    if (values['audio-only'] && values['video-only']) {
        throw new CliConfigError('--audio-only and --video-only cannot be used together.');
    }

    if (values['embed-art'] && values['no-embed-art']) {
        throw new CliConfigError('--embed-art and --no-embed-art cannot be used together.');
    }

    const mediaMode = values['audio-only']
        ? { video: false, audio: true }
        : values['video-only']
            ? { video: true, audio: false }
            : { video: true, audio: true };

    const quality = values.quality.toLowerCase();
    if (!VALID_QUALITY.has(quality)) {
        throw new CliConfigError(`invalid quality "${values.quality}". Use: high, medium, fast`);
    }

    const audioQuality = values['audio-quality']
        ? values['audio-quality'].toLowerCase()
        : quality;
    if (!VALID_QUALITY.has(audioQuality)) {
        throw new CliConfigError(`invalid audio-quality "${values['audio-quality']}". Use: high, medium, fast`);
    }

    if (values['extract-audio'] && values['audio-only']) {
        throw new CliConfigError('--extract-audio requires video sources; omit --audio-only.');
    }

    const deinterlace = values.deinterlace.toLowerCase();
    if (!VALID_DEINTERLACE.has(deinterlace)) {
        throw new CliConfigError(`invalid deinterlace mode "${values.deinterlace}". Use: auto, on, off`);
    }

    if (values.output !== undefined && !values.output.trim()) {
        throw new CliConfigError('--output requires a folder path.');
    }

    if (values.log !== undefined && !values.log.trim()) {
        throw new CliConfigError('--log requires a file path.');
    }

    if (values['master-log'] !== undefined && !values['master-log'].trim()) {
        throw new CliConfigError('--master-log requires a file path.');
    }

    if (values['delete-originals'] && values['no-verify']) {
        throw new CliConfigError('--delete-originals requires post-encode verification (omit --no-verify).');
    }

    if (values['delete-originals'] && values['cleanup-originals']) {
        throw new CliConfigError('--delete-originals and --cleanup-originals cannot be used together.');
    }

    if (values['cleanup-originals'] && values['no-verify']) {
        throw new CliConfigError('--cleanup-originals verifies outputs before deleting (omit --no-verify).');
    }

    if (values['cleanup-originals'] && values.force) {
        throw new CliConfigError('--cleanup-originals skips conversion; omit --force (convert first in a separate run).');
    }

    const target = positionals[0] ?? null;
    if (positionals.length > 1) {
        throw new CliConfigError(`unexpected extra arguments: ${positionals.slice(1).join(' ')}`);
    }

    return {
        force: values.force ?? false,
        dryRun: values['dry-run'] ?? false,
        recursive: values.recursive ?? false,
        outputDir: values.output ? path.resolve(values.output) : null,
        logFile: values.log ? path.resolve(values.log) : path.join(cwd, 'mediatuna-log.txt'),
        masterLogEnabled: !(values['no-master-log'] ?? false),
        masterLogFile: values['master-log']
            ? path.resolve(values['master-log'])
            : path.join(homedir, '.mediatuna', 'history.log'),
        deleteOriginals: values['delete-originals'] ?? false,
        cleanupOriginals: values['cleanup-originals'] ?? false,
        quality,
        audioQuality,
        extractAudio: values['extract-audio'] ?? false,
        deinterlace,
        verify: !(values['no-verify'] ?? false),
        keepPartial: values['keep-partial'] ?? false,
        verbose: values.verbose ?? false,
        mediaMode,
        preferMtime: values['prefer-mtime'] ?? false,
        embedArt: values['no-embed-art'] ? false : (values['embed-art'] ?? true),
        target,
    };
}

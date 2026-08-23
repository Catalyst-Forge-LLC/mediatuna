import os from 'os';
import path from 'path';
import { VALID_DEINTERLACE, VALID_QUALITY } from './constants.js';
import { parseJobsValue } from './jobs.js';
import { parseGlobList } from './globs.js';
import { defaultLedgerJsonPath } from './ledger.js';

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
    resume: { type: 'boolean' },
    jobs: { type: 'string' },
    'stamp-dates': { type: 'boolean' },
    'no-stamp-dates': { type: 'boolean' },
    backup: { type: 'string' },
    'dupe-report': { type: 'boolean' },
    hash: { type: 'boolean' },
    'recup-map': { type: 'boolean' },
    ext: { type: 'string' },
    apply: { type: 'boolean' },
    yes: { type: 'boolean', short: 'y' },
    'delete-permanent': { type: 'boolean' },
    include: { type: 'string', multiple: true },
    exclude: { type: 'string', multiple: true },
    archive: { type: 'string' },
    sample: { type: 'string' },
    'reencode-audio': { type: 'boolean' },
    ledger: { type: 'boolean' },
    'ledger-json': { type: 'boolean' },
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

    if (values.resume && values['dry-run']) {
        throw new CliConfigError('--resume cannot be used with --dry-run.');
    }

    if (values.resume && values['no-verify']) {
        throw new CliConfigError('--resume requires post-encode verification (omit --no-verify).');
    }

    if (values.backup !== undefined && !values.backup.trim()) {
        throw new CliConfigError('--backup requires a folder path.');
    }

    if (values.backup && !values['stamp-dates']) {
        throw new CliConfigError('--backup is only valid with --stamp-dates.');
    }

    if (values['stamp-dates'] && values['delete-originals']) {
        throw new CliConfigError('--stamp-dates cannot be used with --delete-originals.');
    }

    if (values['stamp-dates'] && values['cleanup-originals']) {
        throw new CliConfigError('--stamp-dates cannot be used with --cleanup-originals.');
    }

    if (values['stamp-dates'] && values['extract-audio']) {
        throw new CliConfigError('--stamp-dates cannot be used with --extract-audio.');
    }

    if (values['stamp-dates'] && values.resume) {
        throw new CliConfigError('--stamp-dates cannot be used with --resume.');
    }

    if (values['stamp-dates'] && values.output) {
        throw new CliConfigError('--stamp-dates renames in place; use --backup instead of --output.');
    }

    if (values['stamp-dates'] && values['no-stamp-dates']) {
        throw new CliConfigError('--stamp-dates and --no-stamp-dates cannot be used together.');
    }

    if (values.hash && !values['dupe-report'] && !values['recup-map']) {
        throw new CliConfigError('--hash is only valid with --dupe-report or --recup-map.');
    }

    if (values['delete-permanent'] && !values['delete-originals'] && !values['cleanup-originals']) {
        throw new CliConfigError('--delete-permanent is only valid with --delete-originals or --cleanup-originals.');
    }

    if (values['dupe-report'] && values['stamp-dates']) {
        throw new CliConfigError('--dupe-report cannot be used with --stamp-dates.');
    }

    if (values['dupe-report'] && values['delete-originals']) {
        throw new CliConfigError('--dupe-report cannot be used with --delete-originals.');
    }

    if (values['dupe-report'] && values['cleanup-originals']) {
        throw new CliConfigError('--dupe-report cannot be used with --cleanup-originals.');
    }

    if (values['dupe-report'] && values['extract-audio']) {
        throw new CliConfigError('--dupe-report cannot be used with --extract-audio.');
    }

    if (values['dupe-report'] && values.resume) {
        throw new CliConfigError('--dupe-report cannot be used with --resume.');
    }

    if (values['dupe-report'] && values.output) {
        throw new CliConfigError('--dupe-report writes a text report in the folder; omit --output.');
    }

    if (values.ext && !values['recup-map']) {
        throw new CliConfigError('--ext is only valid with --recup-map.');
    }

    if (values.apply && !values['recup-map']) {
        throw new CliConfigError('--apply is only valid with --recup-map.');
    }

    if (values['recup-map'] && values['dupe-report']) {
        throw new CliConfigError('--recup-map cannot be used with --dupe-report.');
    }

    if (values['recup-map'] && values['stamp-dates']) {
        throw new CliConfigError('--recup-map cannot be used with --stamp-dates.');
    }

    if (values['recup-map'] && values['delete-originals']) {
        throw new CliConfigError('--recup-map cannot be used with --delete-originals. Use --cleanup-originals after --apply.');
    }

    if (values['recup-map'] && values['extract-audio']) {
        throw new CliConfigError('--recup-map cannot be used with --extract-audio.');
    }

    if (values['recup-map'] && values.resume) {
        throw new CliConfigError('--recup-map cannot be used with --resume.');
    }

    if (values.archive !== undefined && !values.archive.trim()) {
        throw new CliConfigError('--archive requires a folder path.');
    }

    if (values.archive && values['delete-originals']) {
        throw new CliConfigError('--archive cannot be used with --delete-originals (move or delete, not both).');
    }

    if (values.archive && values['delete-permanent']) {
        throw new CliConfigError('--archive moves files; omit --delete-permanent.');
    }

    if (values.archive && values['no-verify']) {
        throw new CliConfigError('--archive requires post-encode verification (omit --no-verify).');
    }

    if (values.archive && values['stamp-dates']) {
        throw new CliConfigError('--archive cannot be used with --stamp-dates.');
    }

    if (values.archive && values['dupe-report']) {
        throw new CliConfigError('--archive cannot be used with --dupe-report.');
    }

    if (values.archive && values['recup-map']) {
        throw new CliConfigError('--archive cannot be used with --recup-map.');
    }

    let sampleSeconds = null;
    if (values.sample !== undefined) {
        const n = Number(values.sample);
        if (!Number.isInteger(n) || n < 1 || n > 600) {
            throw new CliConfigError('--sample requires an integer number of seconds from 1 to 600.');
        }
        sampleSeconds = n;
    }

    if (sampleSeconds && (values['delete-originals'] || values['cleanup-originals'] || values.archive)) {
        throw new CliConfigError('--sample writes a short preview only; omit delete/archive flags.');
    }

    if (sampleSeconds && values.resume) {
        throw new CliConfigError('--sample cannot be used with --resume.');
    }

    if (sampleSeconds && values['stamp-dates']) {
        throw new CliConfigError('--sample cannot be used with --stamp-dates.');
    }

    if (sampleSeconds && values['dupe-report']) {
        throw new CliConfigError('--sample cannot be used with --dupe-report.');
    }

    if (sampleSeconds && values['recup-map']) {
        throw new CliConfigError('--sample cannot be used with --recup-map.');
    }

    const ledgerJson = values['ledger-json'] ?? false;
    const ledger = (values.ledger ?? false) || ledgerJson;

    if (ledger && values['stamp-dates']) {
        throw new CliConfigError('--ledger cannot be used with --stamp-dates.');
    }

    if (ledger && values['dupe-report']) {
        throw new CliConfigError('--ledger cannot be used with --dupe-report.');
    }

    if (ledger && values['recup-map']) {
        throw new CliConfigError('--ledger cannot be used with --recup-map.');
    }

    if (ledger && sampleSeconds) {
        throw new CliConfigError('--ledger cannot be used with --sample (samples are not the archive).');
    }

    if (ledger && values['cleanup-originals']) {
        throw new CliConfigError('--ledger writes provenance on new outputs; omit --cleanup-originals.');
    }

    const ledgerJsonPath = ledgerJson
        ? defaultLedgerJsonPath({
            outputDir: values.output ? path.resolve(values.output) : null,
            cwd,
        })
        : null;

    let jobs;
    try {
        jobs = parseJobsValue(values.jobs);
    } catch (err) {
        throw new CliConfigError(err.message);
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
        resume: values.resume ?? false,
        jobs,
        stampDates: values['stamp-dates'] ?? false,
        stampVideo: !(values['no-stamp-dates'] ?? false),
        backupDir: values.backup ? path.resolve(values.backup) : null,
        dupeReport: values['dupe-report'] ?? false,
        dupeHash: values.hash ?? false,
        recupMap: values['recup-map'] ?? false,
        recupExt: values.ext ?? null,
        recupApply: values.apply ?? false,
        yes: values.yes ?? false,
        deletePermanent: values['delete-permanent'] ?? false,
        include: parseGlobList(values.include),
        exclude: parseGlobList(values.exclude),
        archiveDir: values.archive ? path.resolve(values.archive) : null,
        sampleSeconds,
        reencodeAudio: values['reencode-audio'] ?? false,
        ledger,
        ledgerJsonPath,
        target,
    };
}

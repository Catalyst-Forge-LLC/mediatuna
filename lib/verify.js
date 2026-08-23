import fs from 'fs';
import { execFileSync } from 'child_process';
import { lameQuality } from './audio-policy.js';
import { formatSize } from './format.js';
import { formatMtimeDate } from './paths.js';
import { getFormatTags, getMetadata } from './probe.js';
import { findTagValue, hasDateTag, IMPORTANT_TAG_NAMES } from './tags.js';

export function verifyAudioTags(sourceMeta, outPath) {
    const warnings = [];
    const dest = getFormatTags(outPath);
    const dropped = sourceMeta.tagCount - dest.tagCount;
    if (dropped >= 3) {
        warnings.push(`${dropped} tags dropped (${sourceMeta.tagCount} → ${dest.tagCount})`);
    }
    for (const name of IMPORTANT_TAG_NAMES) {
        if (findTagValue(sourceMeta.tags, name) && !findTagValue(dest.tags, name)) {
            warnings.push(`missing ${name} tag in output`);
        }
    }
    return warnings;
}

export function durationToleranceSeconds(expectedDuration) {
    return Math.max(2, expectedDuration * 0.05);
}

export function durationWithinTolerance(actualDuration, expectedDuration) {
    if (!(expectedDuration > 0) || !(actualDuration > 0)) return true;
    return Math.abs(actualDuration - expectedDuration) <= durationToleranceSeconds(expectedDuration);
}

export function verifyOutput(outPath, expectedDuration, expectedType = 'video', verifyContext = null) {
    const meta = getMetadata(outPath);
    if (meta.mediaType !== expectedType) {
        return { ok: false, reason: expectedType === 'audio' ? 'output file has no audio stream' : 'output file is unreadable' };
    }
    if (!durationWithinTolerance(meta.duration, expectedDuration)) {
        return {
            ok: false,
            reason: `duration mismatch (source ${expectedDuration.toFixed(1)}s, output ${meta.duration.toFixed(1)}s)`,
        };
    }

    const warnings = [];
    if (expectedType === 'audio' && verifyContext?.sourceMeta) {
        warnings.push(...verifyAudioTags(verifyContext.sourceMeta, outPath));
        if (verifyContext.sourceSize) {
            const outSize = fs.statSync(outPath).size;
            if (outSize === 0) {
                return { ok: false, reason: 'output file is empty' };
            }
            if (outSize > verifyContext.sourceSize * 10) {
                warnings.push(`output (${formatSize(outSize)}) unusually large vs source (${formatSize(verifyContext.sourceSize)})`);
            }
        }
    }

    return { ok: true, duration: meta.duration, warnings };
}

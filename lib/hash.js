import { createHash } from 'crypto';
import fs from 'fs';

export function sha256File(filePath, readStreamFn = fs.createReadStream) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = readStreamFn(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

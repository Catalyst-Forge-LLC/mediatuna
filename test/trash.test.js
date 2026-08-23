import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { moveToTrash } from '../lib/trash.js';

describe('moveToTrash', () => {
    it('uses the Windows Recycle Bin API', async () => {
        const calls = [];
        await moveToTrash('C:\\archive\\clip.avi', {
            platform: 'win32',
            execFileFn: async (cmd, args) => {
                calls.push({ cmd, args });
            },
        });
        assert.equal(calls[0].cmd, 'powershell.exe');
        assert.match(calls[0].args.join(' '), /SendToRecycleBin/);
        assert.match(calls[0].args.join(' '), /clip\.avi/);
    });

    it('uses Finder on macOS and gio on Linux', async () => {
        const darwin = [];
        await moveToTrash('/tmp/clip.avi', {
            platform: 'darwin',
            execFileFn: async (cmd, args) => { darwin.push({ cmd, args }); },
        });
        assert.equal(darwin[0].cmd, 'osascript');

        const linux = [];
        await moveToTrash('/tmp/clip.avi', {
            platform: 'linux',
            execFileFn: async (cmd, args) => { linux.push({ cmd, args }); },
        });
        assert.equal(linux[0].cmd, 'gio');
        assert.deepEqual(linux[0].args, ['trash', path.resolve('/tmp/clip.avi')]);
    });
});

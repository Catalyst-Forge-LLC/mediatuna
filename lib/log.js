import fs from 'fs';
import path from 'path';

export function createLogger({ logFile: logFilePath, masterLogFile: masterLogFilePath, masterLogEnabled, verbose, getMultibar = () => null }) {
    let masterLogWarningShown = false;

    function appendLog(msg) {
        const ts = new Date().toISOString();
        const line = `[${ts}] ${msg}\n`;
        fs.appendFileSync(logFilePath, line);
        if (masterLogEnabled) {
            try {
                fs.appendFileSync(masterLogFilePath, line);
            } catch (err) {
                if (!masterLogWarningShown) {
                    masterLogWarningShown = true;
                    console.error(`Warning: could not write master log (${masterLogFilePath}): ${err.message}`);
                }
            }
        }
    }

    function logToConsole(msg) {
        const multibar = getMultibar();
        if (multibar?.isActive) multibar.log(msg + '\n');
        else console.log(msg);
    }

    function logFile(msg) {
        appendLog(msg);
    }

    function logConsole(msg) {
        logFile(msg);
        logToConsole(msg);
    }

    function logVerbose(msg) {
        logFile(msg);
        if (verbose) logToConsole(msg);
    }

    function fileLog(msg, index, total) {
        const prefix = total > 1 ? `[${index + 1}/${total}] ` : '';
        logVerbose(prefix + msg);
    }

    function printLines(lines) {
        for (const line of lines) {
            if (line === '') console.log('');
            else console.log(line);
            appendLog(line);
        }
    }

    return { appendLog, logFile, logConsole, logVerbose, fileLog, printLines, logToConsole };
}

export function ensureLogDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

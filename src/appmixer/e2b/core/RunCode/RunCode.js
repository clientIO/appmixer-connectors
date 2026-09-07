'use strict';

const { Sandbox } = require('@e2b/code-interpreter');

module.exports = {

    async receive(context) {

        const { sandboxID, code, language = 'python' } = context.messages.in.content;

        if (!sandboxID) {
            throw new context.CancelError('Sandbox ID is required!');
        }
        if (!code) {
            throw new context.CancelError('Code is required!');
        }

        const sandbox = await Sandbox.connect(sandboxID, { apiKey: context.auth.apiKey });

        const execution = await sandbox.runCode(code, { language });

        const logs = execution.logs || {};
        const stdout = Array.isArray(logs.stdout) ? logs.stdout.join('') : (logs.stdout || '');
        const stderr = Array.isArray(logs.stderr) ? logs.stderr.join('') : (logs.stderr || '');

        return context.sendJson({
            text: execution.text || '',
            stdout,
            stderr,
            error: execution.error ? (execution.error.traceback || execution.error.value || execution.error.name) : '',
            results: execution.results || []
        }, 'out');
    }
};

'use strict';

const { Sandbox } = require('e2b');

module.exports = {

    async receive(context) {

        const { sandboxID, command, cwd } = context.messages.in.content;

        if (!sandboxID) {
            throw new context.CancelError('Sandbox ID is required!');
        }
        if (!command) {
            throw new context.CancelError('Command is required!');
        }

        const sandbox = await Sandbox.connect(sandboxID, { apiKey: context.auth.apiKey });

        const options = {};
        if (cwd) {
            options.cwd = cwd;
        }

        const result = await sandbox.commands.run(command, options);

        return context.sendJson({
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode
        }, 'out');
    }
};

#!/usr/bin/env node
'use strict';

/**
 * One-off helper that logs a Telegram USER account in and prints the Session String the
 * "Telegram User" connection asks for.
 *
 *   cd src/appmixer/telegram && npm install
 *   node artifacts/tools/generate-session.js
 *
 * It asks for the API ID and API Hash (https://my.telegram.org -> API development tools),
 * the phone number, the login code Telegram sends to the account and, when the account has
 * two-step verification, its password. Nothing is stored unless --out is given:
 *
 *   node artifacts/tools/generate-session.js --out ./telegram-user.json
 *
 * writes { apiId, apiHash, session } to that file (mode 0600) instead of printing them.
 *
 * The session string grants full access to the account. Generate one per connection and do
 * not use the same string in two places at once - Telegram revokes such a session.
 */

const fs = require('fs');
const readline = require('readline');
const { Writable } = require('stream');
const { TelegramClient } = require('teleproto');
const { StringSession } = require('teleproto/sessions');
const { Logger } = require('teleproto/extensions/Logger');

const outIndex = process.argv.indexOf('--out');
const outFile = outIndex !== -1 ? process.argv[outIndex + 1] : null;

// readline echoes what is typed through its output stream; muting it hides passwords.
const output = new Writable({
    write(chunk, encoding, callback) {
        if (!output.muted) {
            process.stdout.write(chunk, encoding);
        }
        callback();
    }
});
const rl = readline.createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
let finished = false;
let attempts = 0;

const MAX_ATTEMPTS = 3;
const RETRYABLE = ['PHONE_NUMBER_INVALID', 'PHONE_CODE_INVALID', 'PHONE_CODE_EMPTY', 'PASSWORD_HASH_INVALID'];

rl.on('close', () => {
    if (!finished) {
        console.error('\nInput ended before the login was finished.');
        process.exit(1);
    }
});

const ask = (question, { hidden = false } = {}) => new Promise((resolve) => {

    process.stdout.write(question);
    output.muted = true;
    rl.question('', (answer) => {
        output.muted = false;
        if (hidden || !process.stdin.isTTY) {
            process.stdout.write('\n');
        }
        resolve(answer.trim());
    });
    // Echo ordinary answers, keep passwords hidden.
    output.muted = hidden;
});

(async () => {

    if (outIndex !== -1 && !outFile) {
        throw new Error('--out needs a file path.');
    }

    if (outFile && fs.existsSync(outFile)) {
        throw new Error(`${outFile} already exists. Choose a new file name or delete the file first.`);
    }

    const apiId = parseInt(process.env.TELEGRAM_API_ID || await ask('API ID: '), 10);
    const apiHash = process.env.TELEGRAM_API_HASH || await ask('API Hash: ', { hidden: true });

    if (!apiId || !apiHash) {
        throw new Error('API ID and API Hash are required. Create them at https://my.telegram.org -> API development tools.');
    }

    const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
        connectionRetries: 3,
        baseLogger: new Logger('error')
    });

    await client.start({
        phoneNumber: () => ask('Phone number (international format, e.g. +420123456789): '),
        phoneCode: () => ask('Login code Telegram sent to the account: '),
        password: () => ask('Two-step verification password: ', { hidden: true }),
        // teleproto asks again after an error for as long as this returns false. Only a
        // mistyped phone number, code or password is worth another try.
        onError: (error) => {
            const code = error.errorMessage || error.message;
            attempts += 1;
            console.error(`Login failed: ${code}`);
            return !RETRYABLE.includes(code) || attempts >= MAX_ATTEMPTS;
        }
    });

    const me = await client.getMe();

    if (me.bot) {
        throw new Error('This is a bot account. The Telegram User connection needs a user account.');
    }

    const session = client.session.save();
    const name = me.username ? `@${me.username}` : [me.firstName, me.lastName].filter(Boolean).join(' ');

    if (outFile) {
        // 'wx' refuses an existing file: the 0600 mode only applies to a file this call
        // creates, an existing one would keep whatever permissions it has.
        fs.writeFileSync(outFile, JSON.stringify({ apiId: String(apiId), apiHash, session }, null, 4) + '\n', {
            mode: 0o600,
            flag: 'wx'
        });
        console.log(`Logged in as ${name}. API ID, API Hash and Session String written to ${outFile}.`);
    } else {
        console.log(`\nLogged in as ${name}. Session String (treat it as a password):\n\n${session}\n`);
    }

    await client.destroy();
    finished = true;
    rl.close();
    process.exit(0);
})().catch((error) => {
    const message = error.errorMessage || error.message;
    console.error(message === 'AUTH_USER_CANCEL' ? 'Login was not completed.' : message);
    finished = true;
    rl.close();
    process.exit(1);
});

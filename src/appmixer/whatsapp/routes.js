/* eslint-disable camelcase */
'use strict';

const lib = require('./lib');

// One global endpoint per Meta App:
//   <API_BASE>/plugins/appmixer/whatsapp/events
//
// Meta App admin configures this URL once as the App's webhook callback. All
// connected customers' events for this Appmixer tenant land here. The plugin
// parses each entry, identifies its WABA, and fans events out to listener
// instances (trigger components) subscribed to that WABA via addListener().

module.exports = async context => {

    /**
     * Validation step that runs every time a trigger calls addListener().
     * Currently a lightweight passthrough — listener.params already carries
     * the trigger's accessToken and wabaId.
     *
     * Extend here if we ever need to verify the user actually owns the WABA
     * they're trying to subscribe to (defends against a malicious user
     * subscribing to someone else's wabaId).
     */
    context.onListenerAdded(async listener => {

        const { wabaId } = listener.params || {};
        if (!wabaId) {
            throw new Error('WhatsApp listener requires params.wabaId.');
        }
        // Pass-through. Could be extended with a /debug_token call to
        // confirm the user's token grants access to wabaId.
    });

    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            handler: async (req, h) => {

                // await context.log('info', `whatsapp-plugin-route-event-hit: ${JSON.stringify(req.payload?.object)}`);

                // HMAC verification — uses Meta App secret exposed via plugin config.
                if (!isValidPayload(context, req)) {
                    return h.response(undefined).code(401);
                }

                await context.log('info', `whatsapp-plugin-route-event-hit paylod: ${JSON.stringify(req.payload)}`);

                const body = req.payload;
                if (!body || body.object !== 'whatsapp_business_account') {
                    return {};
                }

                await processWebhook(context, body);
                return {};
            }
        }
    });

    // WhatsApp Embedded Signup page. The OAuth flow lands here (see
    // auth.js → authUrl when `esConfigId` is configured), the page runs
    // Meta's Embedded Signup via the FB JS SDK and redirects back to the
    // engine's OAuth callback with the resulting code. Requirements in the
    // Meta App Dashboard:
    //   - a Login Configuration of type "WhatsApp Embedded Signup"
    //     (its ID goes to Backoffice → appmixer:whatsapp.esConfigId)
    //   - this page's domain in "Allowed Domains for the JavaScript SDK"
    //     + "Login with the JavaScript SDK" toggled on
    context.http.router.register({
        method: 'GET',
        path: '/signup',
        options: {
            auth: false,
            handler: (req, h) => {

                const clientId = context.config?.clientId;
                const esConfigId = context.config?.esConfigId;
                const state = req.query?.state;
                const redirectUri = req.query?.redirect_uri;

                if (!clientId || !esConfigId) {
                    return h.response('WhatsApp Embedded Signup is not configured (clientId/esConfigId missing).').code(500);
                }
                // Guard against open-redirect abuse — only https targets.
                if (!state || !redirectUri || !/^https:\/\//.test(redirectUri)) {
                    return h.response('Missing or invalid state/redirect_uri.').code(400);
                }

                return h.response(renderSignupPage({ clientId, esConfigId, state, redirectUri })).type('text/html');
            }
        }
    });

    // Meta webhook URL verification handshake — Meta sends GET with
    // hub.mode=subscribe, hub.verify_token, hub.challenge.
    context.http.router.register({
        method: 'GET',
        path: '/events',
        options: {
            auth: false,
            handler: async (req, h) => {

                const mode = req.query?.['hub.mode'];
                const challenge = req.query?.['hub.challenge'];
                const verifyToken = req.query?.['hub.verify_token'];

                const expected = context.config?.verifyToken;

                if (mode === 'subscribe' && expected && verifyToken === expected) {
                    return h.response(challenge).type('text/plain').code(200);
                }

                return h.response(undefined).code(403);
            }
        }
    });
};

/**
 * Render the Embedded Signup page. All dynamic values are injected via
 * JSON.stringify so they cannot break out of the script context.
 *
 * Flow: user clicks the button → FB.login() opens Meta's Embedded Signup
 * popup (config_id of the ES Login Configuration) → the WA_EMBEDDED_SIGNUP
 * message event delivers sessionInfo (waba_id, phone_number_id) → the
 * authResponse delivers a code → we redirect to the engine's OAuth
 * callback with code + state (sessionInfo ids attached for diagnostics;
 * the server-side WABA discovery in auth.js uses /debug_token, which
 * carries target_ids for Embedded-Signup-issued tokens).
 */
function renderSignupPage({ clientId, esConfigId, state, redirectUri }) {

    const config = JSON.stringify({ clientId, esConfigId, state, redirectUri });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect WhatsApp</title>
<style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           display: flex; align-items: center; justify-content: center; min-height: 100vh;
           margin: 0; background: #f5f6f7; color: #1c2b33; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.15);
            padding: 40px; max-width: 420px; text-align: center; }
    button { background: #1877f2; border: 0; border-radius: 6px; color: #fff; cursor: pointer;
             font-size: 16px; font-weight: 600; padding: 12px 24px; }
    button:disabled { background: #9cb4c8; cursor: default; }
    p.note { color: #65676b; font-size: 13px; }
</style>
</head>
<body>
<div class="card">
    <h2>Connect your WhatsApp Business Account</h2>
    <p>You will be guided through selecting (or creating) a WhatsApp Business Account and phone number.</p>
    <button id="connect" disabled>Continue with Facebook</button>
    <p class="note" id="status">Loading Facebook SDK…</p>
</div>
<script>
    var CFG = ${config};
    var sessionInfo = null;

    window.addEventListener('message', function(event) {
        if (!/(^|\\.)facebook\\.com$/.test(new URL(event.origin).hostname)) return;
        try {
            var data = JSON.parse(event.data);
            if (data.type === 'WA_EMBEDDED_SIGNUP') sessionInfo = data.data || null;
        } catch (e) { /* not our message */ }
    });

    window.fbAsyncInit = function() {
        FB.init({ appId: CFG.clientId, autoLogAppEvents: false, xfbml: false, version: 'v25.0' });
        var btn = document.getElementById('connect');
        btn.disabled = false;
        document.getElementById('status').textContent = '';
        btn.addEventListener('click', function() {
            btn.disabled = true;
            FB.login(function(response) {
                if (response.authResponse && response.authResponse.code) {
                    var url = new URL(CFG.redirectUri);
                    url.searchParams.set('code', response.authResponse.code);
                    url.searchParams.set('state', CFG.state);
                    if (sessionInfo) {
                        if (sessionInfo.waba_id) url.searchParams.set('waba_id', sessionInfo.waba_id);
                        if (sessionInfo.phone_number_id) url.searchParams.set('phone_number_id', sessionInfo.phone_number_id);
                    }
                    window.location.assign(url.toString());
                } else {
                    btn.disabled = false;
                    document.getElementById('status').textContent =
                        'Login was cancelled or did not complete. Please try again.';
                }
            }, {
                config_id: CFG.esConfigId,
                response_type: 'code',
                override_default_response_type: true,
                extras: { sessionInfoVersion: '3' }
            });
        });
    };
</script>
<script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js"></script>
</body>
</html>`;
}

/**
 * Validate X-Hub-Signature-256 against the raw payload using the Meta App
 * secret. When the secret isn't configured we log and skip — the caller
 * still treats the request as valid (better than locking the user out
 * during initial setup).
 */
function isValidPayload(context, req) {

    const appSecret = context.config?.clientSecret;
    if (!appSecret) {
        context.log('warn', 'whatsapp-plugin-route-event-missing-clientSecret');
        return true;
    }

    const signature = req.headers['x-hub-signature-256'];
    const rawBody = Buffer.isBuffer(req.payload) ? req.payload : null;

    // Some servers parse JSON before us — we can't HMAC-verify a parsed body.
    // Fall back to stringifying with no extra escaping; this is best-effort.
    const payloadString = rawBody
        ? rawBody.toString('utf8')
        : (typeof req.payload === 'string' ? req.payload : JSON.stringify(req.payload));

    const ok = lib.verifyWebhookSignature({
        rawBody: payloadString,
        signatureHeader: signature,
        appSecret
    });

    if (!ok) {
        context.log('error', 'whatsapp-plugin-route-event-invalid-signature');
    }

    return ok;
}

/**
 * Fan out the Meta webhook payload to listeners.
 *
 *   entry[].id            = WABA ID
 *   entry[].changes[]     = events
 *     value.messages[]    = inbound messages
 *     value.statuses[]    = outbound status updates
 *
 * Emits one listener event per message / per status, keyed on:
 *   messages:<wabaId>  →  NewMessage triggers
 *   statuses:<wabaId>  →  MessageStatusUpdated triggers
 */
async function processWebhook(context, body) {

    for (const entry of (body.entry || [])) {
        const wabaId = entry.id;
        if (!wabaId) continue;

        for (const change of (entry.changes || [])) {
            const value = change.value || {};
            const phoneNumberId = value.metadata && value.metadata.phone_number_id;

            if (Array.isArray(value.messages)) {
                for (const msg of value.messages) {
                    await context.triggerListeners({
                        eventName: `messages:${wabaId}`,
                        payload: { ...msg, wabaId, phoneNumberId }
                    });
                }
            }

            if (Array.isArray(value.statuses)) {
                for (const status of value.statuses) {
                    await context.triggerListeners({
                        eventName: `statuses:${wabaId}`,
                        payload: {
                            id: status.id,
                            recipientId: status.recipient_id,
                            status: status.status,
                            timestamp: status.timestamp,
                            conversation: status.conversation,
                            errors: status.errors,
                            wabaId,
                            phoneNumberId
                        }
                    });
                }
            }
        }
    }
}

// Hook transform for POST /hooks/vero-mention (trusted gateway code).
// Accepts the payload the Appmixer "@apx-vero mention" integration sends ({ pr_url }), validates it
// and hands the vero agent a FIXED instruction. Nothing from the payload reaches the agent except
// the PR number, which is validated as digits; the mention text is fetched later by resolve.sh.
//
// One persistent session per pull request: a later mention on the same PR continues the
// conversation of the earlier ones (what was asked, answered and committed), while every turn still
// starts from a fresh resolve.sh. The key is built from the validated number only, so it needs
// hooks.allowRequestSessionKey=true and a hooks.allowedSessionKeyPrefixes entry that admits it.
// The gateway runs turns of one key one after another (see README "Sessions").
const PR_URL = /^https:\/\/api\.github\.com\/repos\/appmixer-ai\/appmixer-connectors\/pulls\/(\d{1,7})$/i;

export default function transform({ payload }) {
    const match = PR_URL.exec(String(payload?.pr_url || '').trim());
    if (!match) {
        return null; // 204: not a pull request of this repository
    }
    const pr = match[1];
    return {
        kind: 'agent',
        agentId: 'vero',
        name: `apx-vero mention on PR #${pr}`,
        sessionKey: `hook:vero:gh:appmixer-connectors:pr:${pr}`,
        sessionMode: 'persistent',
        deliver: false,
        timeoutSeconds: 1800,
        message: [
            `Someone mentioned @apx-vero on pull request #${pr} of Appmixer-ai/appmixer-connectors.`,
            'Follow /root/.openclaw/workspace-vero/mention-responder/INSTRUCTIONS.md exactly,',
            `starting with: cd /root/.openclaw/workspace-vero/mention-responder && ./resolve.sh ${pr}`
        ].join(' ')
    };
}

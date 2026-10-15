// Hook transform for POST /hooks/vero-testing (trusted gateway code).
// Called by the Appmixer integration "CI - project status -> pipeline" when a card of the
// @appmixer-connectors project moves to Testing. Validates every value of the payload and hands the
// vero agent a FIXED instruction: start the deterministic Testing runner with those values.
const PR_URL = /^https:\/\/github\.com\/appmixer-ai\/appmixer-connectors\/pull\/(\d{1,7})$/i;
const ITEM = /^PVTI_[A-Za-z0-9_-]{5,80}$/;
const PROJECT = /^PVT_[A-Za-z0-9_-]{5,80}$/;
const FIELD = /^PVTSSF_[A-Za-z0-9_-]{5,80}$/;
const TARGET = /^Appmixer-ai\/[A-Za-z0-9_.-]{1,100}#\d{1,7}$/;

export default function transform({ payload }) {
    const p = payload || {};
    const pr = (PR_URL.exec(String(p.pr_url || '').trim()) || [])[1];
    const item = String(p.item_node_id || '').trim();
    const project = String(p.project_node_id || '').trim();
    const field = String(p.status_field_id || '').trim();
    const target = String(p.target || '').trim();
    if (!pr || !ITEM.test(item) || !PROJECT.test(project) || !FIELD.test(field) || !TARGET.test(target)) {
        return null; // 204: not a Testing request we accept
    }
    return {
        kind: 'agent',
        agentId: 'vero',
        name: `pipeline Testing of PR #${pr}`,
        sessionMode: 'isolated',
        deliver: false,
        timeoutSeconds: 300,
        message: [
            `Start the Testing stage for pull request #${pr} of Appmixer-ai/appmixer-connectors.`,
            'Follow /root/.openclaw/workspace-vero/pipeline-testing/INSTRUCTIONS.md exactly:',
            `cd /root/.openclaw/workspace-vero/pipeline-testing && ./start.sh ${pr} ${item} ${project} ${field} ${target}`
        ].join(' ')
    };
}

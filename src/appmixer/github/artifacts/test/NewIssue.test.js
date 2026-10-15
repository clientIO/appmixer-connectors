const assert = require('assert');

const NewIssue = require('../../list/NewIssue/NewIssue');

// In-memory stand-in for GET /search/issues: open issues, newest first, one page of 100.
function createContext(issues) {

    const context = {
        properties: { repositoryId: 'octocat/Hello-World', state: 'open' },
        state: {},
        accessToken: 'token',
        sent: [],
        httpRequest: async () => {
            const open = issues.filter(issue => issue.state === 'open').reverse();
            return { data: { total_count: open.length, items: open.slice(0, 100) } };
        },
        sendJson: async data => {
            context.sent.push(data.id);
        },
        saveState: async state => {
            context.state = state;
        }
    };
    return context;
}

function createIssues(count) {

    return Array.from({ length: count }, (item, index) => ({
        id: index + 1,
        state: 'open',
        created_at: new Date(Date.UTC(2026, 0, 1) + index * 60000).toISOString()
    }));
}

describe('github NewIssue', () => {

    it('emits an issue created after the previous tick, once', async () => {

        const issues = createIssues(250);
        const context = createContext(issues);
        await NewIssue.tick(context);
        assert.deepStrictEqual(context.sent, []);

        issues.push({ id: 251, state: 'open', created_at: '2026-02-01T00:00:00.000Z' });
        await NewIssue.tick(context);
        await NewIssue.tick(context);

        assert.deepStrictEqual(context.sent, [251]);
    });

    it('does not emit an old issue that moves onto the page when a newer one is closed', async () => {

        const issues = createIssues(250);
        const context = createContext(issues);
        await NewIssue.tick(context);

        issues[249].state = 'closed';
        await NewIssue.tick(context);
        issues[200].state = 'closed';
        await NewIssue.tick(context);

        assert.deepStrictEqual(context.sent, []);
    });

    it('does not emit an old issue on the first tick after an upgrade from state without a floor', async () => {

        const issues = createIssues(250);
        const context = createContext(issues);
        context.state = { known: issues.slice(150).map(issue => issue.id) };

        // Two closed, one created: issue 150 moves onto the page next to the new 251.
        issues[249].state = 'closed';
        issues[248].state = 'closed';
        issues.push({ id: 251, state: 'open', created_at: '2026-02-01T00:00:00.000Z' });
        await NewIssue.tick(context);

        assert.deepStrictEqual(context.sent, [251]);
    });

    it('emits an older issue that starts to match when all matching issues fit on the page', async () => {

        const issues = createIssues(5);
        issues[0].state = 'closed';
        const context = createContext(issues);
        await NewIssue.tick(context);

        issues[0].state = 'open';
        await NewIssue.tick(context);

        assert.deepStrictEqual(context.sent, [1]);
    });
});

'use strict';
const Promise = require('bluebird');
const mandrill = require('mandrill-api/mandrill');
const API_KEY = 'bzjR9BOFhPkojdmK_SCh1A';
const { URL } = require('url');
const { URLSearchParams } = require('url');

const prepareMessage = (context, emailForApproval, data, variables) => {

    const logoUrl = context.config.logoURL ||
        'https://uploads-ssl.webflow.com/5a9d00dba5e9fa00010cb403/5c4f39b8a29a8f7a92f20dc3_Appmixer-logo.png';

    const approversEmailTemplate = `
        <div style="width: 100%; min-width: 320px; max-width: 1024px; margin: 0 auto;">
            <div style="margin: 0 0 10px">
                <img src="${logoUrl}" 
                    alt="logo" style="display: block; width: 20px; margin: 0 auto; float: left;"> 
                <h1 style="width: 90%; padding-top: 2px; margin: 0 28px; text-align: left; font-size: 14px; color: #2D3142">Tasks</h1> 
            </div> 
            <p style="font-size: 13px;width: 100%; margin: 25px 0 15px; text-align: left; color: #050505;">Hi,</p> 
            <p style="font-size: 13px;width: 100%; margin: 24px 0; text-align: left; color: #050505;">New request for approval came from <b>{{requester_email}}</b></p> 
            <h2 style="width: 100%; margin: 45px 0 15px; text-align: left; color: #050505;font-size: 14px;opacity: 0.9;"> {{task_title}}</h2> 
            <div style="width: 100%;border-radius: 3px;border:1px solid #ECECEC;background: #FCFBFB; padding: 15px 14px 26px;
                            box-sizing: border-box;text-align: left;"> 
                <p style="width: 100%;color: #050505;font-size: 13px;text-align: left;">{{task_description}}</p> 
            </div> 
            <div style="margin: 10px 0;"> 
                <img alt="clock" style="width: 16px; height: 16px; vertical-align: sub;" 
                    src="https://png.pngtree.com/svg/20151126/alarm_clock_small_icon_637578.png"> 
                <span style="margin-left: 6px; font-size: 12px;">{{task_decision_by}}</span> 
            </div> 
            <div style="margin: 15px 0;"> 
                <img alt="person" style="width: 14px; height: 14px; vertical-align: sub;" 
                    src="http://cdn.onlinewebfonts.com/svg/img_405324.png"> 
                <span style="margin-left: 6px; font-size: 12px;">{{requester_email}}</span> 
            </div> 
            <div style="width: 100%; text-align: center;"> 
                <button style="margin: 0 5px; border: none; outline: none; display: inline-block; width: 120px; 
                                   padding: 8px 0; border-radius: 3px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24); 
                                   background: #307EFF;"></span> 
                    <a href="{{task_dashboard_confirm}}" style="text-decoration: none; letter-spacing: 0.2em; 
                                                                    font-size: 12px; color: white !important;"> APPROVE </a> 
                </button> 
                <button style="margin: 0 5px; border: none; outline: none; display: inline-block; width: 120px; padding: 8px 0; 
                                   border-radius: 3px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24); background: #FF4365;"></span> 
                    <a href="{{task_dashboard_reject}}" style="text-decoration: none; letter-spacing: 0.2em; font-size: 12px; 
                                                                   color: white !important;"> REJECT </a> 
                </button> 
            </div> 
            <a href="{{task_dashboard_link_approver}}" style="font-size: 15px;display: block; margin: 28px auto; 
                                                                  text-align: center; text-decoration: none; color: #307EFF;">Visit Dashboard</a> 
            <p style="font-size: 14px;width: 100%; margin: 14px 0; text-align: left; color: #050505;">Please resolve this request by {{task_decision_by}}.</p> 
            <p style="font-size: 14px;width: 100%; margin: 14px 0; text-align: left; color: #050505;">Thanks,</p> 
            <p style="font-size: 14px;width: 100%; margin: 14px 0; text-align: left; color: #050505;">${context.config.emailValediction || 'Your Appmixer Team'}</p> 
        </div>`;

    const requestersEmailTemplate = `
        <div style="width: 100%; min-width: 320px; max-width: 1024px; margin: 0 auto;"> 
            <div style="margin: 0 0 10px"> 
                <img src="${logoUrl}" 
                    alt="logo" style="display: block; width: 20px; margin: 0 auto; float: left;"> 
                <h1 style="width: 90%; padding-top: 2px; margin: 0 28px; text-align: left; font-size: 14px; color: #2D3142">Tasks</h1> 
                </div> 
                    <p style="font-size: 13px;width: 100%; margin: 25px 0 15px; text-align: left; color: #050505;">Hi,</p> 
                    <p style="font-size: 13px;width: 100%; margin: 24px 0; text-align: left; color: #050505;">New request for approval sent to <b>{{approval_email}}</b></p> 
                    <h2 style="width: 100%; margin: 45px 0 15px; text-align: left; color: #050505;font-size: 14px;opacity: 0.9;"> {{task_title}}</h2> 
                    <div style="width: 100%;border-radius: 3px;border:1px solid #ECECEC;background: #FCFBFB; padding: 15px 14px 26px;box-sizing: border-box;text-align: left;"> 
                    <p style="width: 100%;color: #050505;font-size: 13px;text-align: left;">{{task_description}}</p> 
                </div> 
                <div style="margin: 10px 0;"> 
                    <img alt="clock" style="width: 16px; height: 16px; vertical-align: sub;" 
                        src="https://png.pngtree.com/svg/20151126/alarm_clock_small_icon_637578.png"> 
                    <span style="margin-left: 6px; font-size: 12px;">{{task_decision_by}}</span> 
                </div> 
                <div style="margin: 15px 0;"> 
                    <img alt="person" style="width: 14px; height: 14px; vertical-align: sub;" 
                        src="http://cdn.onlinewebfonts.com/svg/img_405324.png"> 
                    <span style="margin-left: 6px; font-size: 12px;">{{requester_email}}</span> 
                </div> 
                <a href="{{task_dashboard_link_requester}}" style="font-size: 15px;display: block; margin: 28px auto; 
                                                                       text-align: center; text-decoration: none; color: #307EFF;">Visit Dashboard</a> 
                <p style="font-size: 13px;width: 100%; margin: 15px 0; text-align: left; color: #050505;">Should be resolved by {{task_decision_by}}.</p> 
                <p style="font-size: 13px;width: 100%; margin: 24px 0; text-align: left; color: #050505;">Thanks,</p> 
                <p style="font-size: 13px;width: 100%; margin: 15px 0; text-align: left; color: #050505;">${context.config.emailValediction || 'Your Appmixer Team'}</p> 
            </div>`;

    return {
        'key': context.auth.apiKey || API_KEY,
        'message': {
            'html': emailForApproval ? approversEmailTemplate : requestersEmailTemplate,
            'subject': context.config.subject || 'New Task',
            'from_email': context.config.fromEmail || 'info@appmixer.com',
            'from_name': context.config.fromName || 'Appmixer Tasks',
            'to': [
                {
                    'email': emailForApproval ? data['approval_email'] : data['requester_email'],
                    'name': emailForApproval ? data['approval_email'] : data['requester_email'],
                    'type': 'to'
                }
            ],
            'headers': {
                'Reply-To': context.config.replyTo || 'info@appmixer.com'
            },
            'important': true,
            'merge': true,
            'merge_language': 'handlebars',
            'global_merge_vars': variables,
            'merge_vars': variables
        },
        'async': false,
        'ip_pool': 'Main Pool',
        'send_at': new Date()
    };
};


async function sendNotifications(context, taskData) {

    const response = await context.callAppmixer({
        endPoint: '/plugins/appmixer/utils/tasks/dashboard-url',
        method: 'GET'
    });
    const dashboardUrl = response.dashboardUrl;
    const approveUrl = new URL(dashboardUrl);
    approveUrl.search = new URLSearchParams([
        ['taskId', taskData.taskId],
        ['action', 'approve'],
        ['secret', taskData.approverSecret]
    ]);
    const rejectUrl = new URL(dashboardUrl);
    rejectUrl.search = new URLSearchParams([
        ['taskId', taskData.taskId],
        ['action', 'reject'],
        ['secret', taskData.approverSecret]
    ]);
    const approverDashboardUrl = new URL(dashboardUrl);
    approverDashboardUrl.search = new URLSearchParams([['secret', taskData.approverSecret], ['role', 'approver']]);
    const requesterDashboardUrl = new URL(dashboardUrl);
    requesterDashboardUrl.search = new URLSearchParams([['secret', taskData.requesterSecret], ['role', 'requester']]);

    const templateData = {
        task_title: taskData.title,
        task_description: taskData.description,
        requester_email: taskData.requester,
        approval_email: taskData.approver,
        task_decision_by: taskData.decisionBy ? new Date(taskData.decisionBy).toUTCString() : '',
        task_dashboard_confirm: approveUrl.toString(),
        task_dashboard_reject: rejectUrl.toString(),
        task_dashboard_link_approver: approverDashboardUrl.toString(),
        task_dashboard_link_requester: requesterDashboardUrl.toString()
    };

    const variables = Object.keys(templateData).map(key => ({ name: key, content: templateData[key] }));

    const client = new mandrill.Mandrill(context.auth.apiKey || API_KEY);
    return Promise.all([
        client.messages.send(prepareMessage(context, true, templateData, variables)),
        client.messages.send(prepareMessage(context, false, templateData, variables))
    ]);
}

module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            const webhookData = context.messages.webhook.content;
            const { data } = webhookData;
            if (data.status !== 'pending') {
                await context.sendJson(data, data.status);
            }
            return context.response({ status: 'success' }, 200, { 'Content-Type': 'application/json' });
        }

        const body = context.messages.task.content;

        if (body.decisionBy) {
            body.decisionBy = new Date(body.decisionBy).toISOString();
        }

        const task = await context.callAppmixer({
            endPoint: '/plugins/appmixer/utils/tasks/tasks',
            method: 'POST',
            body
        });
        if (!task.taskId) {
            throw new Error('Missing task ID, cannot create Request.');
        }
        const webhook = await context.callAppmixer({
            endPoint: '/plugins/appmixer/utils/tasks/webhooks',
            method: 'POST',
            body: { url: context.getWebhookUrl(), taskId: task.taskId }
        });
        if (!webhook.webhookId) {
            throw new Error('Missing webhook ID cannot create Request.');
        }
        await context.stateSet(webhook.webhookId, {});

        await sendNotifications(
            context,
            Object.assign({
                taskId: task.taskId,
                approverSecret: task.approverSecret,
                requesterSecret: task.requesterSecret
            }, context.messages.task.content)
        );
    },

    async stop(context) {

        const state = await context.loadState();
        return Promise.map(Object.keys(state), webhookId => {
            return context.callAppmixer({
                endPoint: `/plugins/appmixer/utils/tasks/webhooks/${webhookId}`,
                method: 'DELETE' });
        });
    }
};

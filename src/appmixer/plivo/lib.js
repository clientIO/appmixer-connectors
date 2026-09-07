'use strict';

/**
 * Shared helpers for the Plivo connector.
 *
 * The webhook triggers (calls/NewCall, sms/NewSMS) receive form-encoded params from Plivo with
 * capitalized keys (From, To, Text, MessageUUID, CallUUID, ...) and emit that object verbatim on
 * their out port. To produce a realistic example in Flow Test Mode without registering a webhook,
 * the test() methods fetch the most recent record via the read-only Plivo REST API (which uses
 * snake_case keys) and reshape it field-for-field into the webhook payload shape.
 */

const BASE_URL = 'https://api.plivo.com/v1';

/**
 * Read-only GET against the Plivo REST API using Basic auth (auth_id:auth_token), the same way
 * core/MakeApiCall builds its requests.
 * @param {Context} context
 * @param {string} path - path appended after /Account/{auth_id} (e.g. '/Message/')
 * @param {object} [params] - query params
 * @returns {Promise<object>} response data
 */
async function apiGet(context, path, params) {
    const { accountSID, authenticationToken } = context.auth;
    const credentials = Buffer.from(`${accountSID}:${authenticationToken}`).toString('base64');
    const response = await context.httpRequest({
        method: 'GET',
        url: `${BASE_URL}/Account/${accountSID}${path}`,
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
        },
        params
    });
    return response.data;
}

module.exports = {

    apiGet,

    /**
     * Fetch the most recent message via REST and reshape it into the form-encoded webhook payload
     * that sms/NewSMS's receive() emits on the 'sms' port. Read-only, touches no state.
     * @param {Context} context
     * @param {object} [filters]
     * @param {string} [filters.phoneNumber] - the receiving (To) number to match
     * @returns {Promise<object|null>}
     */
    async fetchLatestSMS(context, { phoneNumber } = {}) {
        const params = { limit: 1 };
        if (phoneNumber) {
            // Inbound webhooks fire for messages addressed to the connected number.
            params.to_number = phoneNumber;
        }
        const data = await apiGet(context, '/Message/', params);
        const message = (data && data.objects && data.objects[0]) || null;
        if (!message) {
            return null;
        }
        // Map snake_case REST fields -> capitalized webhook param names (outPort options).
        return {
            To: message.to_number,
            From: message.from_number,
            TotalRate: message.total_rate,
            Units: message.units,
            Text: message.text,
            TotalAmount: message.total_amount,
            Type: message.message_type,
            MessageUUID: message.message_uuid
        };
    },

    /**
     * Fetch the most recent call via REST and reshape it into the form-encoded webhook payload
     * that calls/NewCall's receive() emits on the 'call' port. Read-only, touches no state.
     * @param {Context} context
     * @param {object} [filters]
     * @param {string} [filters.phoneNumber] - the receiving (To) number to match
     * @returns {Promise<object|null>}
     */
    async fetchLatestCall(context, { phoneNumber } = {}) {
        const params = { limit: 1 };
        if (phoneNumber) {
            params.to_number = phoneNumber;
        }
        const data = await apiGet(context, '/Call/', params);
        const call = (data && data.objects && data.objects[0]) || null;
        if (!call) {
            return null;
        }
        // Map snake_case REST fields -> capitalized webhook param names (outPort options).
        return {
            Direction: call.call_direction,
            From: call.from_number,
            CallerName: call.caller_name,
            BillRate: call.bill_rate,
            To: call.to_number,
            CallUUID: call.call_uuid,
            CallStatus: call.call_state,
            Event: 'Call',
            TotalCost: call.total_amount,
            BillDuration: call.bill_duration,
            HangupCause: call.hangup_cause_name,
            AnswerTime: call.answer_time,
            StartTime: call.initiation_time,
            Duration: call.call_duration,
            EndTime: call.end_time
        };
    }
};

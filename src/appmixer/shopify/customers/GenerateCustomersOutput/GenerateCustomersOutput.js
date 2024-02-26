'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { sendWholeArray = false, isWebhook = false } = context.properties;
        return context.sendJson({ sendWholeArray, isWebhook }, 'out');
    },

    getOutputOptions({ sendWholeArray, isWebhook }) {
        if (sendWholeArray) {
            return [{ label: 'Customers', value: 'customers' }];
        } else {
            const output = [
                { label: 'Accepts Marketing', value: 'accepts_marketing' },
                { label: 'Accepts Marketing Date', value: 'accepts_marketing_updated_at' },
                { label: 'Addresses', value: 'addresses' },
                { label: 'Date Created', value: 'created_at' },
                { label: 'Currency', value: 'currency' },
                { label: 'Default Address', value: 'default_address' },
                { label: 'Email', value: 'email' },
                { label: 'First Name', value: 'first_name' },
                { label: 'ID', value: 'id' },
                { label: 'Last Name', value: 'last_name' },
                { label: 'Metafield', value: 'metafield' },
                { label: 'Phone', value: 'phone' },
                { label: 'Marketing Opt-in Level', value: 'marketing_opt_in_level' },
                { label: 'Multipass Identifier', value: 'multipass_identifier' },
                { label: 'Last Order ID', value: 'last_order_id' },
                { label: 'Last Order Name', value: 'last_order_name' },
                { label: 'Note', value: 'note' },
                { label: 'Orders Count', value: 'orders_count' },
                { label: 'State', value: 'state' },
                { label: 'Tags', value: 'tags' },
                { label: 'Tax Exempt', value: 'tax_exempt' },
                { label: 'Total Spent', value: 'total_spent' },
                { label: 'Date Updated', value: 'updated_at' },
                { label: 'Email Verified', value: 'verified_email' }
            ];

            if (isWebhook) {
                output.push({ label: 'Webhook Topic', value: 'webhookTopic' });
            }

            return output;
        }
    }
};

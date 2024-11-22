'use strict';
const commons = require('../../pipedrive-commons');
const searchOutput = require('../../searchOutput');

const outputPortName = 'out';
/**
 * FindUser action.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { generateOutputPortOptions } = context.properties;
        let data = context.messages.in.content;
        const usersApi = commons.getPromisifiedClient(context.auth.apiKey, 'Users');

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, data.outputType);
        }

        data['search_by_email'] = data.searchEmail ? 1 : 0;
        delete data.searchEmail;

        const response = await usersApi.findAsync(data);

        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }

        await context.log({ step: 'response', response: response.data });
        return await searchOutput.sendArrayOutput(
            {
                context,
                outputPortName,
                outputType: data.outputType,
                records: response.data
            });
    },

    getOutputPortOptions(context, outputType) {
        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson([
                { label: 'User ID', value: 'id' },
                { label: 'Name', value: 'name' },
                { label: 'Email', value: 'email' },
                { label: 'Language', value: 'lang' },
                { label: 'Locale', value: 'locale' },
                { label: 'Timezone Name', value: 'timezone_name' },
                { label: 'Timezone Offset', value: 'timezone_offset' },
                { label: 'Default Currency', value: 'default_currency' },
                { label: 'Icon Url', value: 'icon_url' },
                { label: 'Active Flag', value: 'active_flag' },
                { label: 'Is Deleted', value: 'is_deleted' },
                { label: 'Is Admin', value: 'is_admin' },
                { label: 'Role Id', value: 'role_id' },
                { label: 'Created', value: 'created' },
                { label: 'Has Created Company', value: 'has_created_company' },
                { label: 'Is You', value: 'is_you' },
                {
                    label: 'Access',
                    value: 'access',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                app: { label: 'App', value: 'app' },
                                admin: { label: 'Admin', value: 'admin' },
                                permission_set_id: { label: 'Permission Set ID', value: 'permission_set_id' }
                            }
                        }
                    }
                },
                { label: 'Phone', value: 'phone' },
                { label: 'Modified', value: 'modified' },
                { label: 'Last Login', value: 'last_login' }
            ], outputPortName);
        } else if (outputType === 'array') {
            return context.sendJson([
                {
                    label: 'Users',
                    value: 'records',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { label: 'User ID', value: 'id' },
                                name: { label: 'Name', value: 'name' },
                                email: { label: 'Email', value: 'email' },
                                lang: { label: 'Language', value: 'lang' },
                                locale: { label: 'Locale', value: 'locale' },
                                timezone_name: { label: 'Timezone Name', value: 'timezone_name' },
                                timezone_offset: { label: 'Timezone Offset', value: 'timezone_offset' },
                                default_currency: { label: 'Default Currency', value: 'default_currency' },
                                icon_url: { label: 'Icon Url', value: 'icon_url' },
                                active_flag: { label: 'Active Flag', value: 'active_flag' },
                                is_deleted: { label: 'Is Deleted', value: 'is_deleted' },
                                is_admin: { label: 'Is Admin', value: 'is_admin' },
                                role_id: { label: 'Role Id', value: 'role_id' },
                                created: { label: 'Created', value: 'created' },
                                has_created_company: { label: 'Has Created Company', value: 'has_created_company' },
                                is_you: { label: 'Is You', value: 'is_you' },
                                access: {
                                    label: 'Access',
                                    value: 'access',
                                    schema: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                app: { label: 'App', value: 'app' },
                                                admin: { label: 'Admin', value: 'admin' },
                                                permission_set_id: { label: 'Permission Set ID', value: 'permission_set_id' }
                                            }
                                        }
                                    }
                                },
                                phone: { label: 'Phone', value: 'phone' },
                                modified: { label: 'Modified', value: 'modified' },
                                last_login: { label: 'Last Login', value: 'last_login' }
                            }
                        }
                    }
                }
            ], outputPortName);
        } else if (outputType === 'file') {
            return context.sendJson([
                { label: 'File ID', value: 'fileId', schema: { type: 'string', format: 'appmixer-file-id' } }
            ], outputPortName);
        } else {
            // Default to array output
            return context.sendJson([], outputPortName);
        }
    }
};

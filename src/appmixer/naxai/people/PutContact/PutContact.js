'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        if (context.properties.generateInspector) {
            return await this.generateInspector(context);
        }

        await this.httpRequest(context);

        // http 204 No Content on success
        return context.sendJson({}, 'out');
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + `/people/contacts/${input['identifier']}`;

        const headers = {
            'X-Client-Id': context.auth.clientId,
            'X-Client-Secret': context.auth.clientSecret
        };

        const inputMapping = {
            'email': input['email'],
            'phone': input['phone'],
            'externalId': input['externalId'],
            'unsubscribed': input['unsubscribed'],
            'language': input['language'],
            'createdAt': input['createdAt']
        };

        // There are additional fields that are not in the static attributes.
        // Add them to the request body.
        Object.keys(input).forEach(key => {
            if (!inputMapping[key]) {
                inputMapping[key] = input[key];
            }
        });

        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        const req = {
            url: url,
            method: 'PUT',
            data: requestBody,
            headers: headers
        };

        try {
            const response = await context.httpRequest(req);
            const log = {
                step: 'http-request-success',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: {
                    data: response.data,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                }
            };
            await context.log(log);
            return response;
        } catch (err) {
            const log = {
                step: 'http-request-error',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: err.response ? {
                    data: err.response.data,
                    status: err.response.status,
                    statusText: err.response.statusText,
                    headers: err.response.headers
                } : undefined
            };
            await context.log(log);
            throw err;
        }
    },

    generateInspector: async function(context) {

        /** Static attributes from https://docs.naxai.com/reference/putcontact */
        const attributes = {
            identifier: {
                type: 'string',
                index: 0,
                label: 'Identifier',
                tooltip: '<p>Identifier of the contact. For more details, see <a href="https://docs.naxai.com/docs/add-and-update-contacts-using-the-api" target="_blank">Naxai documentation</a>. If your contact identifier is set to <code>email</code>, use the email address as the identifier. If your contact identifier is set to <code>phone</code>, use the phone number as the identifier.</p>'
            },
            email: {
                type: 'string',
                index: 1,
                label: 'Email',
                tooltip: ''
            },
            phone: {
                type: 'string',
                index: 2,
                label: 'Phone',
                tooltip: 'Expected pattern: <code>^[0-9]{6,20}$</code>. Example: <code>32499010203</code>'
            },
            externalId: {
                type: 'string',
                index: 3,
                label: 'External Id',
                tooltip: ''
            },
            unsubscribed: {
                type: 'boolean',
                index: 4,
                label: 'Unsubscribed',
                tooltip: ''
            },
            language: {
                type: 'string',
                index: 5,
                label: 'Language',
                tooltip: 'Enter <a href="https://en.wikipedia.org/wiki/ISO_639-1" target="_blank">ISO 639-1</a> code. Example: <code>en</code>.'
            },
            createdAt: {
                type: 'number',
                index: 6,
                label: 'Created At',
                tooltip: 'The date of creation of the contact in seconds. Example: 1671179612'
            }
        };

        const inPort = {
            name: 'in',
            schema: {
                type: 'object',
                required: ['identifier'],
                // Will be populated by the attributes
                properties: {}
            },
            // Will be populated by the attributes
            inputs: {}
        };

        // Add the static attributes to the schema and inspector.
        Object.keys(attributes).forEach(key => {
            inPort.schema.properties[key] = {
                type: attributes[key].type
            };
            inPort.inputs[key] = {
                type: attributes[key].type === 'boolean' ? 'toggle' : attributes[key].type === 'string' ? 'text' : attributes[key].type === 'number' ? 'number' : 'text',
                index: attributes[key].index,
                label: attributes[key].label,
                tooltip: attributes[key].tooltip
            };
        });

        // Call GetAttributes to get the additional fields utilizing existing cache.
        /** Example: [{ name: 'newKey1' }, { name: 'newKey2' }] */
        const { items } = await context.componentStaticCall('appmixer.naxai.people.GetAttributes', 'out', {
            messages: { in: { isSource: true } }
        });
        items.forEach(attribute => {
            inPort.schema.properties[attribute.name] = {
                type: 'string'
            };
            inPort.inputs[attribute.name] = {
                type: 'text',
                index: Object.keys(attributes).length,
                label: attribute.name,
                tooltip: ''
            };
        });

        return context.sendJson(inPort, 'out');
    }

};

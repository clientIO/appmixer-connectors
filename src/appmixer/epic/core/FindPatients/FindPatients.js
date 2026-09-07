'use strict';

const lib = require('../../lib');
const { fhirRequest, extractResources } = require('../../lib');

const schema = {
    'resourceType': {
        'type': 'string',
        'title': 'Resource Type',
        'example': 'Patient'
    },
    'id': {
        'type': 'string',
        'title': 'Patient ID',
        'example': 'eq081-VQEgP8drUUqCWzHfw3'
    },
    'identifier': {
        'type': 'array',
        'title': 'Identifier',
        'items': {
            'type': 'object',
            'properties': {
                'use': {
                    'type': 'string',
                    'title': 'Identifier Use',
                    'example': 'usual'
                },
                'system': {
                    'type': 'string',
                    'title': 'Identifier System',
                    'example': 'urn:oid:1.2.840.114350.1.13.0.1.7.5.737384.0'
                },
                'value': {
                    'type': 'string',
                    'title': 'Identifier Value',
                    'example': 'E4007'
                }
            }
        }
    },
    'active': {
        'type': 'boolean',
        'title': 'Active',
        'example': true
    },
    'name': {
        'type': 'array',
        'title': 'Name',
        'items': {
            'type': 'object',
            'properties': {
                'use': {
                    'type': 'string',
                    'title': 'Name Use',
                    'example': 'official'
                },
                'text': {
                    'type': 'string',
                    'title': 'Name Text',
                    'example': 'Warren McGinnis'
                },
                'family': {
                    'type': 'string',
                    'title': 'Name Family',
                    'example': 'McGinnis'
                },
                'given': {
                    'type': 'array',
                    'title': 'Name Given',
                    'items': {
                        'type': 'string',
                        'example': 'Warren'
                    }
                }
            }
        }
    },
    'telecom': {
        'type': 'array',
        'title': 'Telecom',
        'items': {
            'type': 'object',
            'properties': {
                'system': {
                    'type': 'string',
                    'title': 'Telecom System',
                    'example': 'phone'
                },
                'value': {
                    'type': 'string',
                    'title': 'Telecom Value',
                    'example': '608-555-0123'
                },
                'use': {
                    'type': 'string',
                    'title': 'Telecom Use',
                    'example': 'home'
                }
            }
        }
    },
    'gender': {
        'type': 'string',
        'title': 'Gender',
        'example': 'male'
    },
    'birthDate': {
        'type': 'string',
        'title': 'Birth Date',
        'example': '1952-05-25'
    },
    'address': {
        'type': 'array',
        'title': 'Address',
        'items': {
            'type': 'object',
            'properties': {
                'use': {
                    'type': 'string',
                    'title': 'Address Use',
                    'example': 'home'
                },
                'line': {
                    'type': 'array',
                    'title': 'Address Line',
                    'items': {
                        'type': 'string',
                        'example': '134 Elmstreet'
                    }
                },
                'city': {
                    'type': 'string',
                    'title': 'Address City',
                    'example': 'Madison'
                },
                'state': {
                    'type': 'string',
                    'title': 'Address State',
                    'example': 'WI'
                },
                'postalCode': {
                    'type': 'string',
                    'title': 'Address Postal Code',
                    'example': '53703'
                },
                'country': {
                    'type': 'string',
                    'title': 'Address Country',
                    'example': 'US'
                }
            }
        }
    },
    'maritalStatus': {
        'type': 'object',
        'title': 'Marital Status',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Marital Status Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Marital Status Coding System',
                            'example': 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Marital Status Coding Code',
                            'example': 'M'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Marital Status Coding Display',
                            'example': 'Married'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Marital Status Text',
                'example': 'Married'
            }
        }
    }
};

module.exports = {
    async receive(context) {

        const { family, given, birthdate, identifier, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Patients' });
        }

        const params = {};
        if (family) params.family = family;
        if (given) params.given = given;
        if (birthdate) params.birthdate = birthdate;
        if (identifier) params.identifier = identifier;

        if (Object.keys(params).length === 0) {
            throw new context.CancelError('Provide at least one search criterion (family name, given name, birth date or identifier).');
        }

        const bundle = await fhirRequest(context, { resource: 'Patient', params });
        const records = extractResources(bundle);

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};

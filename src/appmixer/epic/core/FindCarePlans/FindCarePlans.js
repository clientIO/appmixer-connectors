'use strict';

const { runPatientSearch } = require('../../lib');

const schema = {
    'resourceType': {
        'type': 'string',
        'title': 'Resource Type',
        'example': 'CarePlan'
    },
    'id': {
        'type': 'string',
        'title': 'Care Plan ID',
        'example': 'eGVC1cmZBnedTRBGGpiVOtQ3'
    },
    'status': {
        'type': 'string',
        'title': 'Status',
        'example': 'active'
    },
    'intent': {
        'type': 'string',
        'title': 'Intent',
        'example': 'order'
    },
    'category': {
        'type': 'array',
        'title': 'Category',
        'items': {
            'type': 'object',
            'properties': {
                'coding': {
                    'type': 'array',
                    'title': 'Category Coding',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'system': {
                                'type': 'string',
                                'title': 'Category Coding System',
                                'example': 'http://snomed.info/sct'
                            },
                            'code': {
                                'type': 'string',
                                'title': 'Category Coding Code',
                                'example': '38717003'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Category Coding Display',
                                'example': 'Longitudinal care plan'
                            }
                        }
                    }
                },
                'text': {
                    'type': 'string',
                    'title': 'Category Text',
                    'example': 'Longitudinal care plan'
                }
            }
        }
    },
    'title': {
        'type': 'string',
        'title': 'Title',
        'example': 'Diabetes management plan'
    },
    'description': {
        'type': 'string',
        'title': 'Description',
        'example': 'Care plan focused on managing type 2 diabetes'
    },
    'subject': {
        'type': 'object',
        'title': 'Subject',
        'properties': {
            'reference': {
                'type': 'string',
                'title': 'Subject Reference',
                'example': 'Patient/eq081-VQEgP8drUUqCWzHfw3'
            },
            'display': {
                'type': 'string',
                'title': 'Subject Display',
                'example': 'Warren McGinnis'
            }
        }
    },
    'period': {
        'type': 'object',
        'title': 'Period',
        'properties': {
            'start': {
                'type': 'string',
                'title': 'Period Start',
                'example': '2024-01-15'
            },
            'end': {
                'type': 'string',
                'title': 'Period End',
                'example': '2024-12-31'
            }
        }
    }
};

module.exports = {
    async receive(context) {

        const { patient } = context.messages.in.content;

        if (!context.properties.generateOutputPortOptions && !patient) {
            throw new context.CancelError('Patient ID is required!');
        }

        return runPatientSearch(context, {
            resourceType: 'CarePlan',
            label: 'Care Plans',
            schema,
            // Epic rejects CarePlan searches without a category (business rule 59159).
            // SNOMED 38717003 = longitudinal care plan, the type Epic exposes to apps.
            extraParams: { category: '38717003' }
        });
    }
};

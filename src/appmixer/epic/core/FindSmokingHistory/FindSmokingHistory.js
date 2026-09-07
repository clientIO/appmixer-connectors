'use strict';

const { runPatientSearch } = require('../../lib');

const schema = {
    'resourceType': {
        'type': 'string',
        'title': 'Resource Type',
        'example': 'Observation'
    },
    'id': {
        'type': 'string',
        'title': 'Observation ID',
        'example': 'e-Fmt5eLBW21ZvA9Q6pyPWw3'
    },
    'status': {
        'type': 'string',
        'title': 'Status',
        'example': 'final'
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
                                'example': 'http://terminology.hl7.org/CodeSystem/observation-category'
                            },
                            'code': {
                                'type': 'string',
                                'title': 'Category Coding Code',
                                'example': 'social-history'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Category Coding Display',
                                'example': 'Social History'
                            }
                        }
                    }
                },
                'text': {
                    'type': 'string',
                    'title': 'Category Text',
                    'example': 'Social History'
                }
            }
        }
    },
    'code': {
        'type': 'object',
        'title': 'Code',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Code Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Code Coding System',
                            'example': 'http://loinc.org'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Code Coding Code',
                            'example': '72166-2'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Code Coding Display',
                            'example': 'Tobacco smoking status'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Code Text',
                'example': 'Tobacco smoking status'
            }
        }
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
    'effectiveDateTime': {
        'type': 'string',
        'title': 'Effective Date',
        'example': '2023-05-02T14:00:00Z'
    },
    'valueCodeableConcept': {
        'type': 'object',
        'title': 'Value Codeable Concept',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Value Codeable Concept Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Value Codeable Concept Coding System',
                            'example': 'http://snomed.info/sct'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Value Codeable Concept Coding Code',
                            'example': '8517006'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Value Codeable Concept Coding Display',
                            'example': 'Ex-smoker'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Value Codeable Concept Text',
                'example': 'Former smoker'
            }
        }
    },
    'valueString': {
        'type': 'string',
        'title': 'Value String',
        'example': 'Former smoker, quit 2015'
    }
};

module.exports = {
    async receive(context) {

        const { patient } = context.messages.in.content;

        if (!context.properties.generateOutputPortOptions && !patient) {
            throw new context.CancelError('Patient ID is required!');
        }

        return runPatientSearch(context, {
            resourceType: 'Observation',
            label: 'Smoking History',
            schema,
            extraParams: { category: 'social-history' }
        });
    }
};

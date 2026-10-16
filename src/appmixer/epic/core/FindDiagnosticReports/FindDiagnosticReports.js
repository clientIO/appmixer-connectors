'use strict';

const { runPatientSearch } = require('../../lib');

const ITEM_SCHEMA = {
    'type': 'object',
    'properties': {
        'resourceType': {
            'type': 'string',
            'title': 'Resource Type',
            'example': 'DiagnosticReport'
        },
        'id': {
            'type': 'string',
            'title': 'Diagnostic Report ID',
            'example': 'eO0aLnSVpMhWzYYNAmM1KRw3'
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
                                    'example': 'http://terminology.hl7.org/CodeSystem/v2-0074'
                                },
                                'code': {
                                    'type': 'string',
                                    'title': 'Category Coding Code',
                                    'example': 'LAB'
                                },
                                'display': {
                                    'type': 'string',
                                    'title': 'Category Coding Display',
                                    'example': 'Laboratory'
                                }
                            }
                        },
                        'example': [
                            {
                                'system': 'http://terminology.hl7.org/CodeSystem/v2-0074',
                                'code': 'LAB',
                                'display': 'Laboratory'
                            }
                        ]
                    },
                    'text': {
                        'type': 'string',
                        'title': 'Category Text',
                        'example': 'Laboratory'
                    }
                }
            },
            'example': [
                {
                    'coding': [
                        {
                            'system': 'http://terminology.hl7.org/CodeSystem/v2-0074',
                            'code': 'LAB',
                            'display': 'Laboratory'
                        }
                    ],
                    'text': 'Laboratory'
                }
            ]
        },
        'code': {
            'type': 'object',
            'title': 'Code',
            'properties': {
                'coding': {
                    'type': 'array',
                    'title': 'Code.Coding',
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
                                'example': '24323-8'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Code Coding Display',
                                'example': 'Comprehensive metabolic panel'
                            }
                        }
                    },
                    'example': [
                        {
                            'system': 'http://loinc.org',
                            'code': '24323-8',
                            'display': 'Comprehensive metabolic panel'
                        }
                    ]
                },
                'text': {
                    'type': 'string',
                    'title': 'Code.Text',
                    'example': 'Comprehensive metabolic panel'
                }
            }
        },
        'subject': {
            'type': 'object',
            'title': 'Subject',
            'properties': {
                'reference': {
                    'type': 'string',
                    'title': 'Subject.Reference',
                    'example': 'Patient/eq081-VQEgP8drUUqCWzHfw3'
                },
                'display': {
                    'type': 'string',
                    'title': 'Subject.Display',
                    'example': 'Warren McGinnis'
                }
            }
        },
        'effectiveDateTime': {
            'type': 'string',
            'title': 'Effective Date',
            'example': '2023-08-14T15:30:00Z'
        },
        'issued': {
            'type': 'string',
            'title': 'Issued',
            'example': '2023-08-14T18:45:12Z'
        },
        'result': {
            'type': 'array',
            'title': 'Result',
            'items': {
                'type': 'object',
                'properties': {
                    'reference': {
                        'type': 'string',
                        'title': 'Result Reference',
                        'example': 'Observation/eLnbBV6HG8EQ3Q22ZbrGXWA3'
                    },
                    'display': {
                        'type': 'string',
                        'title': 'Result Display',
                        'example': 'Glucose'
                    }
                }
            },
            'example': [
                {
                    'reference': 'Observation/eLnbBV6HG8EQ3Q22ZbrGXWA3',
                    'display': 'Glucose'
                }
            ]
        },
        'conclusion': {
            'type': 'string',
            'title': 'Conclusion',
            'example': 'All values within normal limits.'
        },
        'presentedForm': {
            'type': 'array',
            'title': 'Presented Form',
            'items': {
                'type': 'object',
                'properties': {
                    'contentType': {
                        'type': 'string',
                        'title': 'Presented Form Content Type',
                        'example': 'application/pdf'
                    },
                    'url': {
                        'type': 'string',
                        'title': 'Presented Form URL',
                        'example': 'Binary/eF-KI3iaOFPCoTKe3vBNSFA3'
                    },
                    'title': {
                        'type': 'string',
                        'title': 'Presented Form Title',
                        'example': 'Metabolic panel report'
                    }
                }
            },
            'example': [
                {
                    'contentType': 'application/pdf',
                    'url': 'Binary/eF-KI3iaOFPCoTKe3vBNSFA3',
                    'title': 'Metabolic panel report'
                }
            ]
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { patient } = context.messages.in.content;

        if (!context.properties.generateOutputPortOptions && !patient) {
            throw new context.CancelError('Patient ID is required!');
        }

        return runPatientSearch(context, {
            resourceType: 'DiagnosticReport',
            label: 'Diagnostic Reports',
            schema: ITEM_SCHEMA.properties
        });
    }
};

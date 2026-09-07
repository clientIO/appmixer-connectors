'use strict';

const { runPatientSearch } = require('../../lib');

const schema = {
    'resourceType': {
        'type': 'string',
        'title': 'Resource Type',
        'example': 'Procedure'
    },
    'id': {
        'type': 'string',
        'title': 'Procedure ID',
        'example': 'eSjQ8vromf-fSHNMhInkVHg3'
    },
    'status': {
        'type': 'string',
        'title': 'Status',
        'example': 'completed'
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
                            'example': 'http://snomed.info/sct'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Code Coding Code',
                            'example': '80146002'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Code Coding Display',
                            'example': 'Excision of appendix'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Code Text',
                'example': 'Appendectomy'
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
    'performedDateTime': {
        'type': 'string',
        'title': 'Performed Date',
        'example': '2022-03-18T08:00:00Z'
    },
    'performedPeriod': {
        'type': 'object',
        'title': 'Performed Period',
        'properties': {
            'start': {
                'type': 'string',
                'title': 'Performed Period Start',
                'example': '2022-03-18T08:00:00Z'
            },
            'end': {
                'type': 'string',
                'title': 'Performed Period End',
                'example': '2022-03-18T09:30:00Z'
            }
        }
    },
    'category': {
        'type': 'object',
        'title': 'Category',
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
                            'example': '387713003'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Category Coding Display',
                            'example': 'Surgical procedure'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Category Text',
                'example': 'Surgical procedure'
            }
        }
    },
    'reasonCode': {
        'type': 'array',
        'title': 'Reason Code',
        'items': {
            'type': 'object',
            'properties': {
                'coding': {
                    'type': 'array',
                    'title': 'Reason Code Coding',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'system': {
                                'type': 'string',
                                'title': 'Reason Code Coding System',
                                'example': 'http://snomed.info/sct'
                            },
                            'code': {
                                'type': 'string',
                                'title': 'Reason Code Coding Code',
                                'example': '74400008'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Reason Code Coding Display',
                                'example': 'Appendicitis'
                            }
                        }
                    }
                },
                'text': {
                    'type': 'string',
                    'title': 'Reason Code Text',
                    'example': 'Appendicitis'
                }
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
            resourceType: 'Procedure',
            label: 'Procedures',
            schema
        });
    }
};

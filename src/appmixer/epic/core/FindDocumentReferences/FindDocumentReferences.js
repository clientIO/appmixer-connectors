'use strict';

const { runPatientSearch } = require('../../lib');

const schema = {
    'resourceType': {
        'type': 'string',
        'title': 'Resource Type',
        'example': 'DocumentReference'
    },
    'id': {
        'type': 'string',
        'title': 'Document Reference ID',
        'example': 'eqrfCLzZib7T9CLDBTAULhg3'
    },
    'status': {
        'type': 'string',
        'title': 'Status',
        'example': 'current'
    },
    'docStatus': {
        'type': 'string',
        'title': 'Doc Status',
        'example': 'final'
    },
    'type': {
        'type': 'object',
        'title': 'Type',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Type Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Type Coding System',
                            'example': 'http://loinc.org'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Type Coding Code',
                            'example': '11506-3'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Type Coding Display',
                            'example': 'Progress note'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Type Text',
                'example': 'Progress note'
            }
        }
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
                                'example': 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category'
                            },
                            'code': {
                                'type': 'string',
                                'title': 'Category Coding Code',
                                'example': 'clinical-note'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Category Coding Display',
                                'example': 'Clinical Note'
                            }
                        }
                    }
                },
                'text': {
                    'type': 'string',
                    'title': 'Category Text',
                    'example': 'Clinical Note'
                }
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
    'date': {
        'type': 'string',
        'title': 'Date',
        'example': '2023-09-02T10:15:00Z'
    },
    'description': {
        'type': 'string',
        'title': 'Description',
        'example': 'Office visit progress note'
    },
    'content': {
        'type': 'array',
        'title': 'Content',
        'items': {
            'type': 'object',
            'properties': {
                'attachment': {
                    'type': 'object',
                    'title': 'Content Attachment',
                    'properties': {
                        'contentType': {
                            'type': 'string',
                            'title': 'Content Attachment Content Type',
                            'example': 'text/html'
                        },
                        'url': {
                            'type': 'string',
                            'title': 'Content Attachment URL',
                            'example': 'Binary/eZzn1Ff2cW0Yv3yMm0FBDCw3'
                        },
                        'title': {
                            'type': 'string',
                            'title': 'Content Attachment Title',
                            'example': 'Progress note'
                        }
                    }
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
            resourceType: 'DocumentReference',
            label: 'Documents',
            schema
        });
    }
};

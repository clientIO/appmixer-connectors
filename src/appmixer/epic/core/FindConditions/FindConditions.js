'use strict';

const { runPatientSearch } = require('../../lib');

const schema = {
    'resourceType': {
        'type': 'string',
        'title': 'Resource Type',
        'example': 'Condition'
    },
    'id': {
        'type': 'string',
        'title': 'Condition ID',
        'example': 'eIZzcM9lHTCTXvteEva6q3w3'
    },
    'clinicalStatus': {
        'type': 'object',
        'title': 'Clinical Status',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Clinical Status Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Clinical Status Coding System',
                            'example': 'http://terminology.hl7.org/CodeSystem/condition-clinical'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Clinical Status Coding Code',
                            'example': 'active'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Clinical Status Coding Display',
                            'example': 'Active'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Clinical Status Text',
                'example': 'Active'
            }
        }
    },
    'verificationStatus': {
        'type': 'object',
        'title': 'Verification Status',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Verification Status Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Verification Status Coding System',
                            'example': 'http://terminology.hl7.org/CodeSystem/condition-ver-status'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Verification Status Coding Code',
                            'example': 'confirmed'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Verification Status Coding Display',
                            'example': 'Confirmed'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Verification Status Text',
                'example': 'Confirmed'
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
                                'example': 'http://terminology.hl7.org/CodeSystem/condition-category'
                            },
                            'code': {
                                'type': 'string',
                                'title': 'Category Coding Code',
                                'example': 'problem-list-item'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Category Coding Display',
                                'example': 'Problem List Item'
                            }
                        }
                    }
                },
                'text': {
                    'type': 'string',
                    'title': 'Category Text',
                    'example': 'Problem List Item'
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
                            'example': 'http://snomed.info/sct'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Code Coding Code',
                            'example': '38341003'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Code Coding Display',
                            'example': 'Hypertensive disorder'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Code Text',
                'example': 'Essential hypertension'
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
    'onsetDateTime': {
        'type': 'string',
        'title': 'Onset Date',
        'example': '2019-05-25'
    },
    'recordedDate': {
        'type': 'string',
        'title': 'Recorded Date',
        'example': '2019-06-01'
    }
};

module.exports = {
    async receive(context) {

        const { patient } = context.messages.in.content;

        if (!context.properties.generateOutputPortOptions && !patient) {
            throw new context.CancelError('Patient ID is required!');
        }

        return runPatientSearch(context, {
            resourceType: 'Condition',
            label: 'Conditions',
            schema
        });
    }
};

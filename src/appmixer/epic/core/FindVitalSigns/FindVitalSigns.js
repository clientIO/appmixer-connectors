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
        'example': 'e6sDG4CmL63x0lqXcJ0KOGA3'
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
                                'example': 'vital-signs'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Category Coding Display',
                                'example': 'Vital Signs'
                            }
                        }
                    }
                },
                'text': {
                    'type': 'string',
                    'title': 'Category Text',
                    'example': 'Vital Signs'
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
                            'example': '85354-9'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Code Coding Display',
                            'example': 'Blood pressure panel with all children optional'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Code Text',
                'example': 'Blood pressure'
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
        'example': '2023-11-08T09:20:00Z'
    },
    'valueQuantity': {
        'type': 'object',
        'title': 'Value Quantity',
        'properties': {
            'value': {
                'type': 'number',
                'title': 'Value Quantity Value',
                'example': 72
            },
            'unit': {
                'type': 'string',
                'title': 'Value Quantity Unit',
                'example': 'beats/minute'
            },
            'system': {
                'type': 'string',
                'title': 'Value Quantity System',
                'example': 'http://unitsofmeasure.org'
            },
            'code': {
                'type': 'string',
                'title': 'Value Quantity Code',
                'example': '/min'
            }
        }
    },
    'component': {
        'type': 'array',
        'title': 'Components',
        'items': {
            'type': 'object',
            'properties': {
                'code': {
                    'type': 'object',
                    'title': 'Component Code',
                    'properties': {
                        'coding': {
                            'type': 'array',
                            'title': 'Component Code Coding',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'system': {
                                        'type': 'string',
                                        'title': 'Component Code Coding System',
                                        'example': 'http://loinc.org'
                                    },
                                    'code': {
                                        'type': 'string',
                                        'title': 'Component Code Coding Code',
                                        'example': '8480-6'
                                    },
                                    'display': {
                                        'type': 'string',
                                        'title': 'Component Code Coding Display',
                                        'example': 'Systolic blood pressure'
                                    }
                                }
                            }
                        },
                        'text': {
                            'type': 'string',
                            'title': 'Component Code Text',
                            'example': 'Systolic blood pressure'
                        }
                    }
                },
                'valueQuantity': {
                    'type': 'object',
                    'title': 'Component Value Quantity',
                    'properties': {
                        'value': {
                            'type': 'number',
                            'title': 'Component Value Quantity Value',
                            'example': 120
                        },
                        'unit': {
                            'type': 'string',
                            'title': 'Component Value Quantity Unit',
                            'example': 'mm[Hg]'
                        },
                        'system': {
                            'type': 'string',
                            'title': 'Component Value Quantity System',
                            'example': 'http://unitsofmeasure.org'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Component Value Quantity Code',
                            'example': 'mm[Hg]'
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
            resourceType: 'Observation',
            label: 'Vital Signs',
            schema,
            extraParams: { category: 'vital-signs' }
        });
    }
};

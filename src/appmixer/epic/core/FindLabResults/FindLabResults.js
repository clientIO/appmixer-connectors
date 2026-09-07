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
        'example': 'eLnbBV6HG8EQ3Q22ZbrGXWA3'
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
                                'example': 'laboratory'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Category Coding Display',
                                'example': 'Laboratory'
                            }
                        }
                    }
                },
                'text': {
                    'type': 'string',
                    'title': 'Category Text',
                    'example': 'Laboratory'
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
                            'example': '2345-7'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Code Coding Display',
                            'example': 'Glucose [Mass/volume] in Serum or Plasma'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Code Text',
                'example': 'Glucose'
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
        'example': '2023-08-14T15:30:00Z'
    },
    'valueQuantity': {
        'type': 'object',
        'title': 'Value Quantity',
        'properties': {
            'value': {
                'type': 'number',
                'title': 'Value Quantity Value',
                'example': 98
            },
            'unit': {
                'type': 'string',
                'title': 'Value Quantity Unit',
                'example': 'mg/dL'
            },
            'system': {
                'type': 'string',
                'title': 'Value Quantity System',
                'example': 'http://unitsofmeasure.org'
            },
            'code': {
                'type': 'string',
                'title': 'Value Quantity Code',
                'example': 'mg/dL'
            }
        }
    },
    'valueString': {
        'type': 'string',
        'title': 'Value String',
        'example': 'Negative'
    },
    'interpretation': {
        'type': 'array',
        'title': 'Interpretation',
        'items': {
            'type': 'object',
            'properties': {
                'coding': {
                    'type': 'array',
                    'title': 'Interpretation Coding',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'system': {
                                'type': 'string',
                                'title': 'Interpretation Coding System',
                                'example': 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation'
                            },
                            'code': {
                                'type': 'string',
                                'title': 'Interpretation Coding Code',
                                'example': 'N'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Interpretation Coding Display',
                                'example': 'Normal'
                            }
                        }
                    }
                },
                'text': {
                    'type': 'string',
                    'title': 'Interpretation Text',
                    'example': 'Normal'
                }
            }
        }
    },
    'referenceRange': {
        'type': 'array',
        'title': 'Reference Range',
        'items': {
            'type': 'object',
            'properties': {
                'low': {
                    'type': 'object',
                    'title': 'Reference Range Low',
                    'properties': {
                        'value': {
                            'type': 'number',
                            'title': 'Reference Range Low Value',
                            'example': 70
                        },
                        'unit': {
                            'type': 'string',
                            'title': 'Reference Range Low Unit',
                            'example': 'mg/dL'
                        },
                        'system': {
                            'type': 'string',
                            'title': 'Reference Range Low System',
                            'example': 'http://unitsofmeasure.org'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Reference Range Low Code',
                            'example': 'mg/dL'
                        }
                    }
                },
                'high': {
                    'type': 'object',
                    'title': 'Reference Range High',
                    'properties': {
                        'value': {
                            'type': 'number',
                            'title': 'Reference Range High Value',
                            'example': 99
                        },
                        'unit': {
                            'type': 'string',
                            'title': 'Reference Range High Unit',
                            'example': 'mg/dL'
                        },
                        'system': {
                            'type': 'string',
                            'title': 'Reference Range High System',
                            'example': 'http://unitsofmeasure.org'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Reference Range High Code',
                            'example': 'mg/dL'
                        }
                    }
                },
                'text': {
                    'type': 'string',
                    'title': 'Reference Range Text',
                    'example': '70 - 99 mg/dL'
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
            label: 'Lab Results',
            schema,
            extraParams: { category: 'laboratory' }
        });
    }
};

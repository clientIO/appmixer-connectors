'use strict';

const { runPatientSearch } = require('../../lib');

const ITEM_SCHEMA = {
    'type': 'object',
    'properties': {
        'resourceType': {
            'type': 'string',
            'title': 'Resource Type',
            'example': 'Goal'
        },
        'id': {
            'type': 'string',
            'title': 'Goal ID',
            'example': 'e4uzuBnKGRDSXY0yBQr9dQw3'
        },
        'lifecycleStatus': {
            'type': 'string',
            'title': 'Lifecycle Status',
            'example': 'active'
        },
        'achievementStatus': {
            'type': 'object',
            'title': 'Achievement Status',
            'properties': {
                'coding': {
                    'type': 'array',
                    'title': 'Achievement Status.Coding',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'system': {
                                'type': 'string',
                                'title': 'Achievement Status Coding System',
                                'example': 'http://terminology.hl7.org/CodeSystem/goal-achievement'
                            },
                            'code': {
                                'type': 'string',
                                'title': 'Achievement Status Coding Code',
                                'example': 'in-progress'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Achievement Status Coding Display',
                                'example': 'In Progress'
                            }
                        }
                    },
                    'example': [
                        {
                            'system': 'http://terminology.hl7.org/CodeSystem/goal-achievement',
                            'code': 'in-progress',
                            'display': 'In Progress'
                        }
                    ]
                },
                'text': {
                    'type': 'string',
                    'title': 'Achievement Status.Text',
                    'example': 'In Progress'
                }
            }
        },
        'description': {
            'type': 'object',
            'title': 'Description',
            'properties': {
                'coding': {
                    'type': 'array',
                    'title': 'Description.Coding',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'system': {
                                'type': 'string',
                                'title': 'Description Coding System',
                                'example': 'http://snomed.info/sct'
                            },
                            'code': {
                                'type': 'string',
                                'title': 'Description Coding Code',
                                'example': '289169006'
                            },
                            'display': {
                                'type': 'string',
                                'title': 'Description Coding Display',
                                'example': 'Weight loss'
                            }
                        }
                    },
                    'example': [
                        {
                            'system': 'http://snomed.info/sct',
                            'code': '289169006',
                            'display': 'Weight loss'
                        }
                    ]
                },
                'text': {
                    'type': 'string',
                    'title': 'Description.Text',
                    'example': 'Lose 10 pounds'
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
        'target': {
            'type': 'array',
            'title': 'Target',
            'items': {
                'type': 'object',
                'properties': {
                    'measure': {
                        'type': 'object',
                        'title': 'Target Measure',
                        'properties': {
                            'coding': {
                                'type': 'array',
                                'title': 'Target Measure.Coding',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'system': {
                                            'type': 'string',
                                            'title': 'Target Measure Coding System',
                                            'example': 'http://loinc.org'
                                        },
                                        'code': {
                                            'type': 'string',
                                            'title': 'Target Measure Coding Code',
                                            'example': '29463-7'
                                        },
                                        'display': {
                                            'type': 'string',
                                            'title': 'Target Measure Coding Display',
                                            'example': 'Body weight'
                                        }
                                    }
                                },
                                'example': [
                                    {
                                        'system': 'http://loinc.org',
                                        'code': '29463-7',
                                        'display': 'Body weight'
                                    }
                                ]
                            },
                            'text': {
                                'type': 'string',
                                'title': 'Target Measure.Text',
                                'example': 'Body weight'
                            }
                        }
                    },
                    'detailQuantity': {
                        'type': 'object',
                        'title': 'Target Detail Quantity',
                        'properties': {
                            'value': {
                                'type': 'number',
                                'title': 'Target Detail Quantity.Value',
                                'example': 170
                            },
                            'unit': {
                                'type': 'string',
                                'title': 'Target Detail Quantity.Unit',
                                'example': 'lb'
                            },
                            'system': {
                                'type': 'string',
                                'title': 'Target Detail Quantity.System',
                                'example': 'http://unitsofmeasure.org'
                            },
                            'code': {
                                'type': 'string',
                                'title': 'Target Detail Quantity.Code',
                                'example': '[lb_av]'
                            }
                        }
                    },
                    'dueDate': {
                        'type': 'string',
                        'title': 'Target Due Date',
                        'example': '2024-06-30'
                    }
                }
            },
            'example': [
                {
                    'measure': {
                        'coding': [
                            {
                                'system': 'http://loinc.org',
                                'code': '29463-7',
                                'display': 'Body weight'
                            }
                        ],
                        'text': 'Body weight'
                    },
                    'detailQuantity': {
                        'value': 170,
                        'unit': 'lb',
                        'system': 'http://unitsofmeasure.org',
                        'code': '[lb_av]'
                    },
                    'dueDate': '2024-06-30'
                }
            ]
        },
        'startDate': {
            'type': 'string',
            'title': 'Start Date',
            'example': '2024-01-15'
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
            resourceType: 'Goal',
            label: 'Goals',
            schema: ITEM_SCHEMA.properties
        });
    }
};

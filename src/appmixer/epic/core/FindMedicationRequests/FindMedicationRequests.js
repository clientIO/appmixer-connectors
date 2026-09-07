'use strict';

const { runPatientSearch } = require('../../lib');

const schema = {
    'resourceType': {
        'type': 'string',
        'title': 'Resource Type',
        'example': 'MedicationRequest'
    },
    'id': {
        'type': 'string',
        'title': 'Medication Request ID',
        'example': 'exlvXBLBqAg-U8-tCHWDh2g3'
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
    'medicationReference': {
        'type': 'object',
        'title': 'Medication Reference',
        'properties': {
            'reference': {
                'type': 'string',
                'title': 'Medication Reference Reference',
                'example': 'Medication/eGmO0h6H1cVDlLimIL5x4Vg3'
            },
            'display': {
                'type': 'string',
                'title': 'Medication Reference Display',
                'example': 'lisinopril 10 MG Oral Tablet'
            }
        }
    },
    'medicationCodeableConcept': {
        'type': 'object',
        'title': 'Medication',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Medication Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Medication Coding System',
                            'example': 'http://www.nlm.nih.gov/research/umls/rxnorm'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Medication Coding Code',
                            'example': '314076'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Medication Coding Display',
                            'example': 'lisinopril 10 MG Oral Tablet'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Medication Text',
                'example': 'lisinopril 10 MG Oral Tablet'
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
    'authoredOn': {
        'type': 'string',
        'title': 'Authored On',
        'example': '2023-07-20T09:00:00Z'
    },
    'requester': {
        'type': 'object',
        'title': 'Requester',
        'properties': {
            'reference': {
                'type': 'string',
                'title': 'Requester Reference',
                'example': 'Practitioner/euGDzQdIeVCVMBw5nRSFOZQ3'
            },
            'display': {
                'type': 'string',
                'title': 'Requester Display',
                'example': 'Physician Family Medicine, MD'
            }
        }
    },
    'dosageInstruction': {
        'type': 'array',
        'title': 'Dosage Instruction',
        'items': {
            'type': 'object',
            'properties': {
                'text': {
                    'type': 'string',
                    'title': 'Dosage Instruction Text',
                    'example': 'Take 1 tablet (10 mg total) by mouth once daily.'
                },
                'patientInstruction': {
                    'type': 'string',
                    'title': 'Dosage Instruction Patient Instruction',
                    'example': 'Take 1 tablet by mouth once daily.'
                },
                'route': {
                    'type': 'object',
                    'title': 'Dosage Instruction Route',
                    'properties': {
                        'coding': {
                            'type': 'array',
                            'title': 'Dosage Instruction Route Coding',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'system': {
                                        'type': 'string',
                                        'title': 'Dosage Instruction Route Coding System',
                                        'example': 'http://snomed.info/sct'
                                    },
                                    'code': {
                                        'type': 'string',
                                        'title': 'Dosage Instruction Route Coding Code',
                                        'example': '260548002'
                                    },
                                    'display': {
                                        'type': 'string',
                                        'title': 'Dosage Instruction Route Coding Display',
                                        'example': 'Oral'
                                    }
                                }
                            }
                        },
                        'text': {
                            'type': 'string',
                            'title': 'Dosage Instruction Route Text',
                            'example': 'Oral'
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
            resourceType: 'MedicationRequest',
            label: 'Medication Requests',
            schema
        });
    }
};

'use strict';

const { runPatientSearch } = require('../../lib');

const schema = {
    'resourceType': {
        'type': 'string',
        'title': 'Resource Type',
        'example': 'Immunization'
    },
    'id': {
        'type': 'string',
        'title': 'Immunization ID',
        'example': 'eHXhrCVdBnFObeh8jqAje2A3'
    },
    'status': {
        'type': 'string',
        'title': 'Status',
        'example': 'completed'
    },
    'vaccineCode': {
        'type': 'object',
        'title': 'Vaccine Code',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Vaccine Code Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Vaccine Code Coding System',
                            'example': 'http://hl7.org/fhir/sid/cvx'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Vaccine Code Coding Code',
                            'example': '140'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Vaccine Code Coding Display',
                            'example': 'Influenza, seasonal, injectable, preservative free'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Vaccine Code Text',
                'example': 'Influenza, seasonal, injectable, preservative free'
            }
        }
    },
    'patient': {
        'type': 'object',
        'title': 'Patient',
        'properties': {
            'reference': {
                'type': 'string',
                'title': 'Patient Reference',
                'example': 'Patient/eq081-VQEgP8drUUqCWzHfw3'
            },
            'display': {
                'type': 'string',
                'title': 'Patient Display',
                'example': 'Warren McGinnis'
            }
        }
    },
    'occurrenceDateTime': {
        'type': 'string',
        'title': 'Occurrence Date',
        'example': '2023-10-12'
    },
    'lotNumber': {
        'type': 'string',
        'title': 'Lot Number',
        'example': 'UT7643AA'
    },
    'site': {
        'type': 'object',
        'title': 'Site',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Site Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Site Coding System',
                            'example': 'http://terminology.hl7.org/CodeSystem/v3-ActSite'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Site Coding Code',
                            'example': 'LA'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Site Coding Display',
                            'example': 'Left arm'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Site Text',
                'example': 'Left arm'
            }
        }
    },
    'route': {
        'type': 'object',
        'title': 'Route',
        'properties': {
            'coding': {
                'type': 'array',
                'title': 'Route Coding',
                'items': {
                    'type': 'object',
                    'properties': {
                        'system': {
                            'type': 'string',
                            'title': 'Route Coding System',
                            'example': 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Route Coding Code',
                            'example': 'IM'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Route Coding Display',
                            'example': 'Injection, intramuscular'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Route Text',
                'example': 'Injection, intramuscular'
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
            resourceType: 'Immunization',
            label: 'Immunizations',
            schema
        });
    }
};

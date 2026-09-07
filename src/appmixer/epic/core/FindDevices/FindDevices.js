'use strict';

const { runPatientSearch } = require('../../lib');

const schema = {
    'resourceType': {
        'type': 'string',
        'title': 'Resource Type',
        'example': 'Device'
    },
    'id': {
        'type': 'string',
        'title': 'Device ID',
        'example': 'e1BUmZBHF6nyLJ8-EFDrDGg3'
    },
    'status': {
        'type': 'string',
        'title': 'Status',
        'example': 'active'
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
                            'example': 'http://snomed.info/sct'
                        },
                        'code': {
                            'type': 'string',
                            'title': 'Type Coding Code',
                            'example': '704708004'
                        },
                        'display': {
                            'type': 'string',
                            'title': 'Type Coding Display',
                            'example': 'Cardiac pacemaker'
                        }
                    }
                }
            },
            'text': {
                'type': 'string',
                'title': 'Type Text',
                'example': 'Cardiac pacemaker'
            }
        }
    },
    'manufacturer': {
        'type': 'string',
        'title': 'Manufacturer',
        'example': 'Medtronic'
    },
    'modelNumber': {
        'type': 'string',
        'title': 'Model Number',
        'example': 'Azure XT DR MRI'
    },
    'serialNumber': {
        'type': 'string',
        'title': 'Serial Number',
        'example': 'PZK600124S'
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
    'deviceName': {
        'type': 'array',
        'title': 'Device Name',
        'items': {
            'type': 'object',
            'properties': {
                'name': {
                    'type': 'string',
                    'title': 'Device Name Value',
                    'example': 'Pacemaker'
                },
                'type': {
                    'type': 'string',
                    'title': 'Device Name Type',
                    'example': 'user-friendly-name'
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
            resourceType: 'Device',
            label: 'Devices',
            schema
        });
    }
};

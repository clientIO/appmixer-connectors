module.exports = {
    events: {
        type: 'expression',
        index: 6,
        label: 'Runtime Events',
        levels: ['AND'],
        fields: {
            id: {
                type: 'text',
                index: 1,
                label: 'Vulnerability ID',
                tooltip: 'The unique ID of the discovered vulnerability finding.',
                required: true
            },
            timestamp: {
                type: 'text',
                index: 2,
                label: 'Timestamp',
                tooltip: 'The timestamp of the event.',
                required: true
            },
            name: {
                type: 'text',
                index: 3,
                label: 'Name',
                tooltip: 'The name of the event, for example, "GDPR - Personal Sensitive".',
                required: true
            },
            description: {
                type: 'text',
                index: 4,
                label: 'Description',
                tooltip: 'A description of the finding.'
            },
            externalFindingLink: {
                type: 'text',
                index: 5,
                label: 'External Finding Link',
                tooltip: 'A link to the source of the external finding.',
                required: true
            },
            severity: {
                type: 'select',
                index: 6,
                label: 'Severity',
                defaultValue: 'MEDIUM',
                tooltip: 'The severity of the vulnerability. Default is Medium',
                required: true,
                options: [
                    { label: 'INFORMATIONAL', value: 'INFORMATIONAL' },
                    { label: 'LOW', value: 'LOW' },
                    { label: 'MEDIUM', value: 'MEDIUM' },
                    { label: 'HIGH', value: 'HIGH' },
                    { label: 'CRITICAL', value: 'CRITICAL' }
                ]
            },
            mitreTacticIds: {
                type: 'textarea',
                index: 7,
                label: 'Mitre Tactic Ids',
                tooltip: 'Comma separated list of "Mitre Technique Ids". At least one value must be present in the array. Wiz supports V13. <a href="https://attack.mitre.org/tactics/enterprise/" target="_blank">View the list of Mitre Tactic IDs</a>. <br/>For example: TA0001,TA0040',
                required: true
            },
            mitreTechniqueIds: {
                type: 'textarea',
                index: 8,
                label: 'Mitre Technique Ids',
                tooltip: 'Comma separated list of \'Mitre Technique Ids\'. At least one value must be present in the array. Wiz supports V13. <a href="https://attack.mitre.org/versions/v13/techniques/enterprise/" target="_blank">View the list of Mitre Technique IDs</a>.<br/>For example: G0094,G1040',
                required: true
            },
            commandLine: {
                type: 'text',
                index: 9,
                label: 'Command Line',
                tooltip: 'The text of the command line that triggered the event.'
            },
            path: {
                type: 'text',
                index: 10,
                label: 'Path',
                tooltip: 'The Path of the file that triggered the event.'
            },
            hash: {
                type: 'text',
                index: 11,
                label: 'Hash',
                tooltip: 'SHA1 hash of a malicious file related to the event.'
            },
            principal: {
                type: 'text',
                index: 12,
                label: 'Principal',
                tooltip: 'A unique identifier assigned to the actor of this event: ARN—AWS, Resource group—Azure.'
            },
            ipAddress: {
                type: 'text',
                index: 13,
                label: 'IP Address',
                tooltip: 'The IP Address of the Actor.'
            }
        }
    }
};

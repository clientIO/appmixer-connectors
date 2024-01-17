const path = require('path');
const assert = require('assert');
const _ = require('lodash');
const { getComponentJsonFiles } = require('./utils');

/** Existing components with old outports, eg. 'item','items' */
const legacyOutputTypesComponents = [];

describe('component.json', () => {

    const componentJsonFiles = getComponentJsonFiles(path.join(__dirname, '..', '..', 'src', 'appmixer'));
    componentJsonFiles.forEach(file => {

        const componentJson = require(path.join(file));

        describe(componentJson.name, () => {

            it('properties', () => {
                const componentsWithoutDescription = [
                    'appmixer.zoom.meeting.meetingCreated',
                    'appmixer.zoom.meeting.meetingDeleted',
                    'appmixer.zoom.meeting.meetingEnded',
                    'appmixer.zoom.meeting.meetingParticipantJoined',
                    'appmixer.zoom.meeting.meetingParticipantLeft',
                    'appmixer.zoom.meeting.meetingStarted',
                    'appmixer.zoom.meeting.meetingUpdated',
                    'appmixer.zoom.meeting.recordingCompleted',
                    'appmixer.zoom.meeting.recordingStopped',
                    'appmixer.zoom.meeting.recordingStarted',
                    'appmixer.zoom.meeting.webinarParticipantJoined',
                    'appmixer.zoom.meeting.webinarParticipantLeft'
                ];
                assert(componentJson.name, 'Component should have a name');
                if (!componentsWithoutDescription.includes(componentJson.name)) {
                    assert(componentJson.description, 'Component should have a description');
                }
                if (componentJson.version) {
                    assert(/^[0-9]+\.[0-9]+\.[0-9]+$/.test(componentJson.version), 'Component should have a version in semver format');
                }
            });

            describe('inPorts', () => {

                const inPorts = componentJson.inPorts;

                // If there is outputType, check it. Find the first occurence of outputType.
                const portWithOutputType = _.find(inPorts, port => port.schema?.properties?.outputType);
                if (portWithOutputType && !legacyOutputTypesComponents.includes(componentJson.name)) {
                    it('outputType', () => {
                        if (portWithOutputType.schema.properties.outputType.enum) {
                            // enum: ["attachment", "attachments"]
                            assert.ok(portWithOutputType.schema.properties.outputType.enum, 'outputType should be an enum in schema');
                        } else {
                            assert.equal(portWithOutputType.schema.properties.outputType.type, 'string', 'outputType should be a string in schema');
                        }
                        assert.equal(portWithOutputType.inspector.inputs.outputType.type, 'select', 'outputType should be a select in inspector');
                        // Check its options: ['array', 'object', 'string', 'number', 'boolean', 'null']
                        const optionValues = portWithOutputType.inspector.inputs.outputType.options
                            .map(option => option.value);
                        assert.deepEqual(optionValues, ['array', 'object', 'file'], 'outputType should have standard options');
                    });
                }

                const required = _.first(inPorts)?.schema?.required || [];
                const schemaProperties = _.first(inPorts)?.schema?.properties || {};
                const schemaPropertyNames = Object.keys(schemaProperties);
                const inspectorInputs = _.first(inPorts)?.inspector?.inputs || {};
                const inspectorInputNames = Object.keys(inspectorInputs);

                if (schemaPropertyNames && schemaPropertyNames.length > 0) {
                    // TODO: Check generated components and decide how to proceed, eg. getCompanyCompanies
                    it.skip('schema', () => {
                        schemaPropertyNames.forEach(schemaPropertyName => {
                            assert.ok(inspectorInputNames.includes(schemaPropertyName), `Schema field [${schemaPropertyName}] should be in the inspector`);
                        });
                    });
                }

                if (required.length > 0) {
                    it('required', () => {
                        required.forEach(requiredField => {
                            assert.ok(schemaPropertyNames.includes(requiredField), `Required field [${requiredField}] should be in the schema`);
                        });
                    });
                }
            });

            describe('outPorts', () => {

                const ignoredComponents = [
                    'appmixer.hubspot.crm.DeletedContact'
                ];
                if (ignoredComponents.includes(componentJson.name)) {
                    return;
                }

                const outPorts = componentJson.outPorts;
                if (!outPorts) {
                    return;
                }

                for (const outPort of outPorts) {
                    const options = outPort.options;
                    if (options?.length) {
                        it('options', () => {
                            options.forEach(option => {
                                assert.ok(option.value, 'Option should have a value');
                                assert.ok(option.label, 'Option should have a label');
                                // Each word should start with a capital letter.
                                assert.match(option.label, /^[A-Z][A-Za-z0-9]*( [A-Z0-9][A-Za-z0-9]*)*$/, 'Option label should be in "Start Case": ' + option.label);
                            });
                        });
                    }
                }
            });
        });
    });
});

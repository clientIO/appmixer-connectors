const path = require('path');
const assert = require('assert');
const _ = require('lodash');
const { getComponentJsonFiles } = require('../../utils');

describe('component.json', () => {

    const componentJsonFiles = getComponentJsonFiles(path.join(__dirname, '../../..', '..', 'src', 'appmixer', 'google', 'spreadsheets'));
    componentJsonFiles.forEach(file => {

        const componentJson = require(path.join(file));

        describe(componentJson.name, () => {

            it('quota', () => {
                // Should have a quota object
                assert.ok(_.isObject(componentJson.quota), 'quota object is missing for ' + componentJson.name);
            });
        });
    });
});

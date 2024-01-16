// Loop through all the package.json files and test them.

const path = require('path');
const assert = require('assert');
const _ = require('lodash');
const { getPackageJsonFiles } = require('./utils');

describe('package.json', () => {

    const packageJsonFiles = getPackageJsonFiles(path.join(__dirname, '..', '..', 'src', 'appmixer'));
    packageJsonFiles.forEach(file => {

        const packageJson = require(path.join(file));
        const relativePath = path.relative(path.join(__dirname, '..', '..'), file);

        describe(relativePath, () => {

            it('dependencies', () => {

                const ignoredFiles = [
                    { file: 'hubspot/package.json', dependencies: ['axios', 'bluebird', 'request', 'request-promise'] }
                ];

                // Assert that all dependencies in the package.json are in "version only" format. No range, no URL, no git.
                _.forEach(packageJson.dependencies, (version, dependency) => {
                    // Skip appmixer-lib
                    if (dependency === 'appmixer-lib') {
                        return;
                    }

                    const isIgnoredFile = _.find(ignoredFiles, (ignoredFile) => {
                        // Current file ends with the ignored file path.
                        return file.endsWith(ignoredFile.file) && _.includes(ignoredFile.dependencies, dependency);
                    });
                    if (isIgnoredFile) {
                        return;
                    }

                    assert.match(version, /^\d+\.\d+\.\d+$/, `Dependency ${dependency} has version ${version} which is not an exact version format.`);
                });
            });
        });
    });
});

const fs = require('fs');
const path = require('path');

function getComponentJsonFiles(dir) {

    const files = fs.readdirSync(dir);
    const componentJsonFiles = [];

    files.forEach(file => {

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            componentJsonFiles.push(...getComponentJsonFiles(filePath));
        } else if (file.endsWith('component.json')) {
            if (filePath.indexOf('node_modules') !== -1) {
                return;
            }
            componentJsonFiles.push(filePath);
        }
    });

    return componentJsonFiles;
}

function getPackageJsonFiles(dir) {

    const files = fs.readdirSync(dir);
    const componentJsonFiles = [];

    files.forEach(file => {

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            componentJsonFiles.push(...getPackageJsonFiles(filePath));
        } else if (file.endsWith('package.json')) {
            // Not interested in the package.json files in the node_modules folder.
            if (filePath.indexOf('node_modules') !== -1) {
                return;
            }
            componentJsonFiles.push(filePath);
        }
    });

    return componentJsonFiles;
}

module.exports = {
    getComponentJsonFiles,
    getPackageJsonFiles
};

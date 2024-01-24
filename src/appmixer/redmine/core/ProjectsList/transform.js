'use strict';

const lib = require('../../lib');

module.exports = {

    toSelectOptions(msg) {

        const transform = 'projects[].{value: id, label: name}' || 'result[].{value: id, label: name}';
        const options = lib.jmespath.search(msg, transform);
        return options;
    }
};

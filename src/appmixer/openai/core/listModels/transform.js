'use strict';

const lib = require('../../lib');

module.exports = {

    toSelectOptions(msg) {

        const transform = 'result[].{value:id, label:id}' || 'result[].{value: id, label: name}';
        const options = lib.jmespath.search(msg, transform);
        return options;
    }
};

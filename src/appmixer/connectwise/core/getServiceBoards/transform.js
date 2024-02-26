'use strict';

// Generated from OpenAPI specification.

const jmespath = require('jmespath');

module.exports = {

    toSelectOptions(msg) {

        const transform = "result[].{value: id, label: name}" || "result[].{value: id, label: name}";
        const options = jmespath.search(msg, transform);
        return options;
    }
};
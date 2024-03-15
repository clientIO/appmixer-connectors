'use strict';

module.exports.targetLanguagesToSelectArray = (list) => {

    let transformed = [];

    if (Array.isArray(list)) {
        list.forEach((item) => {
            transformed.push({
                label: item.name,
                value: item.code
            });
        });
    }
    return transformed;
};

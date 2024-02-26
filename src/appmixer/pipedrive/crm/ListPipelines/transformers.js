'use strict';

/**
 * @param {Object|string} pipelines
 */
module.exports.pipelinesToSelectArray = pipelines => {

    let transformed = [];

    if (Array.isArray(pipelines)) {
        pipelines.forEach((pipeline) => {

            transformed.push({
                label: pipeline.name,
                value: pipeline.id
            });
        });
    }

    return transformed;
};

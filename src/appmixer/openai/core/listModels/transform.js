'use strict';

module.exports = {

    toSelectOptions({ result }) {
        return result.map(model => {
            return { label: model.id, value: model.id };
        });

    }
};

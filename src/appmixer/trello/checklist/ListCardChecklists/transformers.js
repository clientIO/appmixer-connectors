'use strict';

module.exports.cardChecklistsToSelectArray = (checklists) => {

    let transformed = [];

    if (Array.isArray(checklists)) {
        checklists.forEach((checklist) => {

            transformed.push({
                label: checklist.name,
                value: checklist.id
            });
        });
    }

    return transformed;
};

'use strict';

module.exports = {

    listsToSelectArray(lists) {

        return (lists || []).map(list => ({
            label: list.name,
            value: list.id
        }));
    }
};

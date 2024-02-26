'use strict';

/**
 * Cursor based paging for FB api.
 */
class CursorPaging {

    /**
     * @param {function} func - get function that will be called with cursor URL
     */
    constructor(func) {

        this.func = func;
        this.accumulator = [];
    }

    /**
     * Fetch all records.
     * @param {string} next - cursor URL for next page
     * @return {Promise<Array[Object]>}
     */
    async fetch(next) {

        let res = await this.func(next);
        if (res['data'] && res['data'].length) {
            this.accumulator = this.accumulator.concat(res['data']);
        }
        if (res['paging'] && res['paging']['next']) {
            return this.fetch(res['paging']['next']);
        }
        return this.accumulator;
    }
}

module.exports.CursorPaging = CursorPaging;

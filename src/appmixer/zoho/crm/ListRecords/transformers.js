/* eslint-disable camelcase */
module.exports = {


    /**
     * List of persons
     * @param {Array} records
     * @returns
     */
    personsToSelectArray: ({ records }) => {

        let transformed = [];
        if (Array.isArray(records)) {
            transformed = records.map(({ id, Full_Name, Email }) => ({
                label: `${Full_Name}<${Email}>`,
                value: id.toString()
            }));
        }
        return transformed;
    }
};

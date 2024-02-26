/* eslint-disable camelcase */
module.exports = {

    /**
     * Prepares list for fields having data type picklist
     * @param {Array} fields
     * @returns
     */
    listPickValues: (fields) => {

        let transformed = [];
        if (Array.isArray(fields)) {
            fields.forEach(field => {
                transformed = field.pick_list_values.map(
                    ({ display_value, actual_value }) => ({ label: display_value, value: actual_value })
                );

            });
        }
        return transformed;
    },

    /**
     * List of fields for selectable array
     * @param {Array} fields
     * @returns
     */
    toSelectArray: (fields) => {

        let transformed = [];
        if (Array.isArray(fields)) {
            transformed = fields.map(
                ({ field_label, api_name }) => ({ label: field_label, value: api_name })
            );

        }
        return transformed;
    },


    /**
     * List of fields for single record
     * @param {Array} fields
     * @returns
     */
    toSingleRecordSelectArray: (fields) => {

        let transformed = [];
        if (Array.isArray(fields)) {
            transformed = fields.map(
                ({ field_label, api_name }) => ({ label: field_label, value: api_name })
            );
            transformed.unshift({
                label: 'ID',
                value: 'id'
            });
        }
        return transformed;
    }
};

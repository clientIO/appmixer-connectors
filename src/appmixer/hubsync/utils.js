"use strict";

/**
 * Utility functions for HubSync connector components
 */
module.exports = {
    /**
     * Convert an array of objects with id and title to a select array format
     * 
     * @param {Array} items Array of objects with id and title properties
     * @param {Object} options Optional configuration
     * @param {string} options.labelKey Property name to use for labels (default: 'title')
     * @param {string} options.valueKey Property name to use for values (default: 'id')
     * @returns {Array} Array of {label, value} objects for select inputs
     */
    toSelectArray(items, options = {}) {
        const labelKey = options.labelKey || 'title';
        const valueKey = options.valueKey || 'id';
        
        if (!items || !Array.isArray(items)) {
            return [];
        }
        
        return items.map(item => ({
            label: item[labelKey],
            value: item[valueKey]
        }));
    },
    
    /**
     * Parse JSON fields safely
     * 
     * @param {string} fieldsString JSON string of fields
     * @param {Object} context Component context for error handling
     * @returns {Object} Parsed fields object
     */
    parseFields(fieldsString, context) {
        try {
            return JSON.parse(fieldsString);
        } catch (error) {
            throw new context.CancelError('Invalid fields JSON');
        }
    },
    
    /**
     * Generate inspector configuration for columns
     * 
     * @param {Array} columns Array of column objects
     * @returns {Object} Inspector configuration
     */
    columnsToInspector(columns) {
        let inspector = {
            inputs: {},
            groups: {
                columns: {
                    label: "Columns",
                    index: 1
                }
            }
        };
        
        if (Array.isArray(columns) && columns.length > 0) {
            columns.forEach((column, index) => {
                inspector.inputs[column.id] = {
                    label: column.title,
                    type: "text",
                    group: "columns",
                    index: index + 1
                };
            });
        }
        
        return inspector;
    }
};
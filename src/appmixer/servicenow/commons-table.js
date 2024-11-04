const { getBasicAuth } = require('./lib');

/**
 * Converts table schema to outPort schema.
 * @param {object} tableSchema Obtained from ServiceNow via `getTableSchema()`.
 * @returns OutPort schema
 */
async function getOutPortSchemaFromTableSchema(context, tableName, outputType) {

    const tableSchema = await getTableSchema(context, tableName);

    if (outputType === 'item') {
        // return the schema for single item
        return tableSchema.map(field => {
            return { label: field.column_label, value: field.element };
        });
    } else {
        // return the schema for array of items
        const propertiesFromTableSchema = tableSchema.map(field => {
            const type = field.internal_type === 'integer' ? 'number' : 'string';
            return { [field.element]: { type, title: field.column_label } };
        });
        return [
            {
                label: 'Items', value: 'items', schema: {
                    type: 'array', items: {
                        type: 'object', properties: propertiesFromTableSchema
                    }
                }
            }
        ];
    }
}

/** Gets table schema from ServiceNow.
 * @param {object} context Appmixer context.
 * @param {string} tableName Table name, eg `sys_user`.
 * @returns {object} Table schema object
 * @example [{
	column_label: 'First name',
	internal_type: 'string',
	element: 'first_name'
  },{
	column_label: 'Created by',
	internal_type: 'string',
	element: 'sys_created_by'
  }]
*/
async function getTableSchema(context, tableName) {

    const options = {
        method: 'GET',
        url: `https://${context.auth.instance}.service-now.com/api/now/table/sys_dictionary`,
        headers: {
            'User-Agent': 'Appmixer (info@appmixer.com)',
            'Authorization': ('Basic ' + getBasicAuth(context.auth.username, context.auth.password))
        },
        params: {
            sysparm_display_value: false,
            sysparm_exclude_reference_link: true,
            sysparm_query: 'GOTOname=' + tableName,
            sysparm_fields: 'element,column_label,internal_type'
        }
    };

    try {
        const { data } = await context.httpRequest(options);
        return data?.result?.filter(field => field.element);
    } catch (error) {
        if (error.response?.status === 404) {
            // Table not found.
            return null;
        }
        throw error;
    }
}

module.exports = {
    getOutPortSchemaFromTableSchema
};

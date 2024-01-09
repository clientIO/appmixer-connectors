'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Component for fetching an item.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const data = await commons.makeRequest({
            query: queries.getItem,
            options: {
                variables: { id: +(context.messages.in.content.itemId) }
            },
            apiKey: context.auth.apiKey
        });
        let item = data.items[0];
        item?.column_values?.map(val => {
            item[`column_value_${val.id}_id`] = val.id,
                item[`column_value_${val.id}_text`] = val.text,
                item[`column_value_${val.id}_title`] = val.title,
                item[`column_value_${val.id}_type`] = val.type,
                item[`column_value_${val.id}_value`] = val.value,
                item[`column_value_${val.id}_additional_info`] = val.additional_info;
        });

        if (context.properties.generateOutputPortOptions) {
            let options = this.getOutputPortOptions(item);
            return context.sendJson(options, 'out');
        }
        return context.sendJson(item, 'out');
    },

    getOutputPortOptions(item) {

        let columnLabelMap = {
            id: 'ID',
            text: 'Text',
            title: 'Title',
            type: 'Type',
            value: 'Value',
            additional_info: 'Additional Info'
        };
        let options = [
            {
                label: 'Id',
                value: 'id'
            },
            {
                label: 'Name',
                value: 'name'
            },
            {
                label: 'Parent Item Id',
                value: 'parent_item.id'
            },
            {
                label: 'Created At',
                value: 'created_at'
            },
            {
                label: 'Updated At',
                value: 'updated_at'
            },
            {
                label: 'Creator Id',
                value: 'creator_id'
            },
            {
                label: 'Group Id',
                value: 'group.id'
            },
            {
                label: 'Group Title',
                value: 'group_title'
            },
            {
                label: 'State',
                value: 'state'
            },
            {
                label: 'Subscribers',
                value: 'subscribers'
            },
            {
                label: 'Recent Updates',
                value: 'updates'
            },
            {
                label: 'Assets',
                value: 'assets'
            }
        ];
        item?.column_values?.map(val => {

            for (const pro in val) {
                let label = `[Column ${columnLabelMap[pro]}] ${val.title}`;
                let value = `column_value_${val.id}_${pro}`;
                options.push({ label, value });
            }
        });
        return options;
    }
};


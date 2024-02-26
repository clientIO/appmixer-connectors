'use strict';
const xlsxHelpers = require('../xlsx-helpers');

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;
        const savedFile = await xlsxHelpers.convertFile(
            context,
            fileId,
            xlsxHelpers.CSV2Workbook,
            'xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        return context.sendJson(savedFile, 'out');
    }
};

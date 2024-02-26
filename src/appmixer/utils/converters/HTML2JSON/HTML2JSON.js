'use strict';
const xlsxHelpers = require('../xlsx-helpers');

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;
        const savedFile = await xlsxHelpers.convertFile2JSON(
            context,
            fileId,
            xlsxHelpers.HTML2Workbook
        );
        return context.sendJson(savedFile, 'out');
    }
};

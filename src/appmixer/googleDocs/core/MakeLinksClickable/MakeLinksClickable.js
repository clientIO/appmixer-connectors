'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { documentId } = context.messages.in.content;

        // First, get the document content to find URLs
        const { data: document } = await context.httpRequest({
            method: 'GET',
            url: `https://docs.googleapis.com/v1/documents/${documentId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Find all text content and search for URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const requests = [];
        let linksCount = 0;

        // Function to process text elements recursively
        function processTextElements(elements) {
            if (!elements) return;

            for (const element of elements) {
                if (element.paragraph) {
                    processTextElements(element.paragraph.elements);
                } else if (element.textRun && element.textRun.content) {
                    const text = element.textRun.content;
                    const matches = [...text.matchAll(urlRegex)];
                    
                    for (const match of matches) {
                        const url = match[0];
                        const startIndex = element.startIndex + match.index;
                        const endIndex = startIndex + url.length;

                        // Add request to update text formatting with link
                        requests.push({
                            updateTextStyle: {
                                range: {
                                    startIndex: startIndex,
                                    endIndex: endIndex
                                },
                                textStyle: {
                                    link: {
                                        url: url
                                    }
                                },
                                fields: 'link'
                            }
                        });
                        linksCount++;
                    }
                } else if (element.table) {
                    // Process table cells
                    for (const row of element.table.tableRows) {
                        for (const cell of row.tableCells) {
                            processTextElements(cell.content);
                        }
                    }
                }
            }
        }

        // Process the document content
        processTextElements(document.body.content);

        // Apply the link formatting if any URLs were found
        if (requests.length > 0) {
            await context.httpRequest({
                method: 'POST',
                url: `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: { requests }
            });
        }

        return context.sendJson({
            documentId: documentId,
            linksCount: linksCount,
            success: true
        }, 'out');
    }
};

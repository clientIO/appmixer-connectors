const { arrayBuffer } = require('node:stream/consumers');
let pdfjslib;

// The output contract of ONE driveItem, as ListFiles and FindFilesOrFolders emit it: the raw
// Graph resource, since microsoft-commons.sendArrayOutput passes records through untouched.
// Exported so `appmixer connector verify` and the outport validators can read a shape that a
// dynamic (source) out port otherwise hides.
//
// `required` is only id and name — the two fields every driveItem carries. `file` is present
// only on files and `folder` only on folders (FindFilesOrFolders and a non-recursive ListFiles
// return both), and `shared` only on shared items; `required` drives FAIL vs WARN in
// `appmixer connector verify`, so listing a conditional field there would fail healthy records.
//
// The field names are the ones Graph really returns. The array output used to declare flattened
// names (createdByUserId, parentReferencePath, ...) that never existed in the data.
const DRIVE_ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'name'],
    properties: {
        id: { type: 'string', title: 'Item ID', example: '01MKL5JZL32WKHVOOMVBBL5BE7NAUCKUFA' },
        name: { type: 'string', title: 'Item Name', example: 'quarterly-report.docx' },
        createdDateTime: {
            type: 'string',
            format: 'date-time',
            title: 'Created Date Time',
            example: '2026-01-15T10:30:00Z'
        },
        lastModifiedDateTime: {
            type: 'string',
            format: 'date-time',
            title: 'Last Modified Date Time',
            example: '2026-01-16T08:12:45Z'
        },
        cTag: { type: 'string', title: 'C Tag', example: '"c:{70D9C57D-716F-4DAA-9C3D-536F4ABDE0E7},1"' },
        eTag: { type: 'string', title: 'E Tag', example: '"{70D9C57D-716F-4DAA-9C3D-536F4ABDE0E7},1"' },
        // Graph returns size as a number of bytes, not a string.
        size: { type: 'integer', title: 'Size', example: 174 },
        webUrl: {
            type: 'string',
            title: 'Web URL',
            example: 'https://appmixer.sharepoint.com/sites/Team/Shared%20Documents/quarterly-report.docx'
        },
        createdBy: {
            type: 'object',
            title: 'Created By',
            properties: {
                user: {
                    type: 'object',
                    title: 'Created By.User',
                    properties: {
                        email: { type: 'string', title: 'Created By.User.Email', example: 'john@example.onmicrosoft.com' },
                        id: { type: 'string', title: 'Created By.User.ID', example: '7ffda3a7-99d5-459e-b233-0f99d197536d' },
                        displayName: { type: 'string', title: 'Created By.User.Display Name', example: 'John Smith' }
                    }
                }
            }
        },
        lastModifiedBy: {
            type: 'object',
            title: 'Last Modified By',
            properties: {
                user: {
                    type: 'object',
                    title: 'Last Modified By.User',
                    properties: {
                        email: { type: 'string', title: 'Last Modified By.User.Email', example: 'john@example.onmicrosoft.com' },
                        id: { type: 'string', title: 'Last Modified By.User.ID', example: '7ffda3a7-99d5-459e-b233-0f99d197536d' },
                        displayName: { type: 'string', title: 'Last Modified By.User.Display Name', example: 'John Smith' }
                    }
                }
            }
        },
        parentReference: {
            type: 'object',
            title: 'Parent Reference',
            properties: {
                driveType: { type: 'string', title: 'Parent Reference.Drive Type', example: 'documentLibrary' },
                driveId: { type: 'string', title: 'Parent Reference.Drive ID', example: 'b!f5je7iG5gEyXTnUc4-qTnPINlZ7H1YFB' },
                id: { type: 'string', title: 'Parent Reference.ID', example: '01CDTPCLZREDQFGIWQH5CKC7AQP76IVUFB' },
                path: { type: 'string', title: 'Parent Reference.Path', example: '/drives/b!f5je7iG5gEyXTnUc4/root:/Reports' },
                siteId: { type: 'string', title: 'Parent Reference.Site ID', example: 'eede987f-b921-4c80-974e-751ce3ea939c' }
            }
        },
        // Files only — the marker ListFiles itself uses to tell a file from a folder.
        file: {
            type: 'object',
            title: 'File',
            properties: {
                mimeType: { type: 'string', title: 'File.Mime Type', example: 'text/plain' },
                hashes: {
                    type: 'object',
                    title: 'File.Hashes',
                    properties: {
                        quickXorHash: { type: 'string', title: 'File.Hashes.Quick Xor Hash', example: 'PeQKH69yPhdN/Ym8IxnBb+lKLos=' }
                    }
                }
            }
        },
        // Folders only.
        folder: {
            type: 'object',
            title: 'Folder',
            properties: {
                childCount: { type: 'integer', title: 'Folder.Child Count', example: 12 }
            }
        },
        fileSystemInfo: {
            type: 'object',
            title: 'File System Info',
            properties: {
                createdDateTime: {
                    type: 'string',
                    format: 'date-time',
                    title: 'File System Info.Created Date Time',
                    example: '2026-01-15T10:30:00Z'
                },
                lastModifiedDateTime: {
                    type: 'string',
                    format: 'date-time',
                    title: 'File System Info.Last Modified Date Time',
                    example: '2026-01-16T08:12:45Z'
                }
            }
        },
        shared: {
            type: 'object',
            title: 'Shared',
            properties: {
                scope: { type: 'string', title: 'Shared.Scope', example: 'users' }
            }
        }
    }
};

/**
 * Out-port variable-picker options for a driveItem list, matching what
 * microsoft-commons.sendArrayOutput emits for each outputType:
 * array -> { result, count }, object/first -> the record fields plus index/count,
 * file -> { fileId, count }.
 * @param {string} outputType
 * @return {Array<Object>}
 */
function buildDriveItemPortOptions(outputType) {

    if (outputType === 'array') {
        return [
            { label: 'Items', value: 'result', schema: { type: 'array', items: DRIVE_ITEM_SCHEMA } },
            { label: 'Items Count', value: 'count', schema: { type: 'integer' } }
        ];
    }

    if (outputType === 'file') {
        return [
            { label: 'File ID', value: 'fileId' },
            { label: 'Items Count', value: 'count', schema: { type: 'integer' } }
        ];
    }

    // 'object' (one by one) and 'first' both emit one record, plus its position in the run.
    const fields = Object.keys(DRIVE_ITEM_SCHEMA.properties).map(key => {
        const { title, ...schema } = DRIVE_ITEM_SCHEMA.properties[key];
        return { label: title, value: key, schema };
    });

    return fields.concat([
        { label: 'Current Item Index', value: 'index', schema: { type: 'integer' } },
        { label: 'Items Count', value: 'count', schema: { type: 'integer' } }
    ]);
}

module.exports = {

    DRIVE_ITEM_SCHEMA,

    buildDriveItemPortOptions,

    pdfToText: async function(stream) {
        if (!pdfjslib) {
            pdfjslib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        }

        const loadingTask = pdfjslib.getDocument({ data: await arrayBuffer(stream) });
        const pdfDoc = await loadingTask.promise;

        let fullText = '';
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const content = await page.getTextContent();
            if (content.items.length) {
                const strings = content.items.map(item => item.str || '');
                fullText += strings.join(' ') + '\n\n';
            }
        }

        return fullText;
    },

    /**
     * Normalize multiselect input (array or string) to array format.
     * Strings are treated as single values or comma-separated lists.
     * @param {string|string[]} input
     * @param {object} context
     * @param {string} fieldName
     * @returns {string[]}
     */
    normalizeMultiselectInput(input, context, fieldName) {

        if (Array.isArray(input)) {
            return input;
        } else if (typeof input === 'string') {
            // Handle single string value or comma-separated string
            return input.split(',').map(item => item.trim()).filter(item => item.length > 0);
        } else {
            throw new context.CancelError(`${fieldName} must be a string or an array`);
        }
    }
};

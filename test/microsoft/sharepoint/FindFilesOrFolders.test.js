const assert = require('assert');
const sinon = require('sinon');

const testUtils = require('../../utils.js');

const mimeTypes = {
    image: 'image/',
    video: 'video/',
    audio: 'audio/',
    text: 'text/',
    pdf: 'application/pdf',
    document: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sheet: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

// for better visualization what is the expected drive structure on Sharepoint
const driveStructure = {
    driveId: 'b!Eto4gvCk5kGuQy-Oows-CFPOHQ5TCtFPlXQ3zGEzyRHn89UIDHxEQ4Hpqwvc7N08',
    driveName: 'MochaTestLib',
    MochaTestLib: [
        {
            type: 'folder',
            name: 'rootSubfolder1',
            items: [
                {
                    type: 'folder',
                    name: 'subfolder1Subfolder',
                    items: [
                        {
                            type: 'file',
                            name: 'subfolder1Subfolder_testDocument.docx',
                            mimeType: mimeTypes.document
                        },
                        {
                            type: 'file',
                            name: 'subfolder1Subfolder_testExcel.xlsx',
                            mimeType: mimeTypes.sheet
                        },
                        {
                            type: 'file',
                            name: 'subfolder1Subfolder_testImage.png',
                            mimeType: mimeTypes.image
                        },
                        {
                            type: 'file',
                            name: 'subfolder1Subfolder_testTXT.txt',
                            mimeType: mimeTypes.text
                        },
                        {
                            type: 'file',
                            name: 'subfolder1Subfolder_testPDF.pdf',
                            mimeType: mimeTypes.pdf
                        }
                    ]
                },
                {
                    type: 'file',
                    name: 'rootSubfolder1_testDocument.docx',
                    mimeType: mimeTypes.document
                },
                {
                    type: 'file',
                    name: 'rootSubfolder1_testExcel.xlsx',
                    mimeType: mimeTypes.sheet
                },
                {
                    type: 'file',
                    name: 'rootSubfolder1_testImage.png',
                    mimeType: mimeTypes.image
                },
                {
                    type: 'file',
                    name: 'rootSubfolder1_testTXT.txt',
                    mimeType: mimeTypes.text
                },
                {
                    type: 'file',
                    name: 'rootSubfolder1_testPDF.pdf',
                    mimeType: mimeTypes.pdf
                }
            ]
        },
        {
            type: 'folder',
            name: 'rootSubfolder2',
            items: [
                {
                    type: 'file',
                    name: 'rootSubfolder2_testDocument.docx',
                    mimeType: mimeTypes.document
                },
                {
                    type: 'file',
                    name: 'rootSubfolder2_testExcel.xlsx',
                    mimeType: mimeTypes.sheet
                },
                {
                    type: 'file',
                    name: 'rootSubfolder2_testImage.png',
                    mimeType: mimeTypes.image
                },
                {
                    type: 'file',
                    name: 'rootSubfolder2_testTXT.txt',
                    mimeType: mimeTypes.text
                },
                {
                    type: 'file',
                    name: 'rootSubfolder2_testPDF.pdf',
                    mimeType: mimeTypes.pdf
                }
            ]
        },
        {
            type: 'file',
            name: 'root_testDocument.docx',
            mimeType: mimeTypes.document
        },
        {
            type: 'file',
            name: 'root_testExcel.xlsx',
            mimeType: mimeTypes.sheet
        },
        {
            type: 'file',
            name: 'root_testImage.png',
            mimeType: mimeTypes.image
        },
        {
            type: 'file',
            name: 'root_testTXT.txt',
            mimeType: mimeTypes.text
        },
        {
            type: 'file',
            name: 'root_testPDF.pdf',
            mimeType: mimeTypes.pdf
        }
    ]
};

// Needs to be updated before test
const accessToken = '';

// all tests assume nobody did anything inside the MochaTestLib like adding/deleting file etc
describe('Search files in root', () => {
    let context;

    beforeEach(() => {
        context = testUtils.createMockContext();
        sinon.reset();

        context.auth = {
            accessToken,
            profileInfo: {
                userPrincipalName: 'USER_PRINCIPAL_NAME'
            }
        };
        context.messages = {
            in: {
                content: {
                    driveId: driveStructure.driveId,
                    outputType: 'array'
                }
            }
        };
    });

    it('Finds all files and folders with no restriction', async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');

        await action.receive(context);

        const data = context.sendJson.args[0][0];
        //console.log(data);
        const rootSubfolderIndex = data.result.findIndex((item) => item.name === 'rootSubfolder1');

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, 23, 'should return everything in the drive');
        assert.notEqual(rootSubfolderIndex, -1, 'rootSubfolder1 should exist');
    });

    it('Finds all text files', async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const mimeType = mimeTypes.text;
        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    fileTypesRestriction: [mimeType]
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, 4, 'should return only 4 text files');
        const allCorrectTypes = data.result.every((item) => item.file.mimeType.startsWith(mimeType));
        assert.equal(allCorrectTypes, true, `all files should have mimeType: ${mimeType}`);
    });

    it('Finds all image files', async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const mimeType = mimeTypes.image;
        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    fileTypesRestriction: [mimeType]
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, 4, 'should return only 4 image files');
        const allCorrectTypes = data.result.every((item) => item.file.mimeType.startsWith(mimeType));
        assert.equal(allCorrectTypes, true, `all files should have mimeType: ${mimeType}`);
    });

    it('Finds all document files', async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const mimeType = mimeTypes.document;
        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    fileTypesRestriction: [mimeType]
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, 4, 'should return only 4 document files');
        const allCorrectTypes = data.result.every((item) => item.file.mimeType.startsWith(mimeType));
        assert.equal(allCorrectTypes, true, `all files should have mimeType: ${mimeType}`);
    });

    it('Finds all sheet files', async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const mimeType = mimeTypes.sheet;
        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    fileTypesRestriction: [mimeType]
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, 4, 'should return only 4 sheet files');
        const allCorrectTypes = data.result.every((item) => item.file.mimeType.startsWith(mimeType));
        assert.equal(allCorrectTypes, true, `all files should have mimeType: ${mimeType}`);
    });

    it('Finds all PDF files', async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const mimeType = mimeTypes.pdf;
        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    fileTypesRestriction: [mimeType]
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, 4, 'should return only 4 PDF files');
        const allCorrectTypes = data.result.every((item) => item.file.mimeType.startsWith(mimeType));
        assert.equal(allCorrectTypes, true, `all files should have mimeType: ${mimeType}`);
    });
});

describe.only('Search files with parent path', () => {
    let context;
    const parentPaths = {
        rootSubfolder1: 'rootSubfolder1',
        rootSubfolder2: 'rootSubfolder2',
        subfolder1Subfolder: 'rootSubfolder1/subfolder1Subfolder'
    };

    beforeEach(() => {
        context = testUtils.createMockContext();
        sinon.reset();

        context.auth = {
            accessToken,
            profileInfo: {
                userPrincipalName: 'USER_PRINCIPAL_NAME'
            }
        };
        context.messages = {
            in: {
                content: {
                    driveId: driveStructure.driveId,
                    outputType: 'array'
                }
            }
        };
    });

    it(`Finds all files in /${parentPaths.rootSubfolder1} recursively`, async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const totalFiles = 10;

        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    parentPath: parentPaths.rootSubfolder1
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, totalFiles, `should return ${totalFiles} files in total`);
    });

    it(`Finds all files in /${parentPaths.rootSubfolder2} recursively`, async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const totalFiles = 5;

        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    parentPath: parentPaths.rootSubfolder2
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, totalFiles, `should return ${totalFiles} files in total`);
    });

    it(`Finds all files in /${parentPaths.subfolder1Subfolder} recursively`, async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const totalFiles = 5;

        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    parentPath: parentPaths.subfolder1Subfolder
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, totalFiles, `should return ${totalFiles} files in total`);
    });

    it(`Finds all text files in /${parentPaths.rootSubfolder1} recursively`, async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const totalFiles = 2;
        const mimeType = mimeTypes.text;

        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    parentPath: parentPaths.rootSubfolder1,
                    fileTypesRestriction: [mimeType]
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, totalFiles, `should return ${totalFiles} files in total`);
        const allCorrectTypes = data.result.every((item) => item.file.mimeType.startsWith(mimeType));
        assert.equal(allCorrectTypes, true, `all files should have mimeType: ${mimeType}`);
    });

    it(`Finds all files in /${parentPaths.rootSubfolder1} recursively with name 'subfolder1Subfolder'`, async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');
        const totalFiles = 5;

        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    parentPath: parentPaths.rootSubfolder1,
                    q: 'subfolder1Subfolder'
                }
            }
        };

        await action.receive(context);

        const data = context.sendJson.args[0][0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, totalFiles, `should return ${totalFiles} files in total`);
    });

    it.only(`Finds all files in /${parentPaths.rootSubfolder1} recursively with name 'rootSubfolder2'`, async () => {
        const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');

        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    parentPath: parentPaths.rootSubfolder1,
                    q: 'rootSubfolder2'
                }
            }
        };

        await action.receive(context);

        const [data, outportName] = context.sendJson.args[0];
        console.log(data);

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.deepStrictEqual(data, {}, 'should be an empty object');
        assert.equal(outportName, 'notFound', 'should be sent to notFound output port');
    });
});

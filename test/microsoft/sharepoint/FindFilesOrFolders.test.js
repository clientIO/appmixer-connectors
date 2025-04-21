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

const action = require('../../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders.js');

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
        await action.receive(context);

        const data = context.sendJson.args[0][0];

        const rootSubfolderIndex = data.result.findIndex((item) => item.name === 'rootSubfolder1');

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.equal(data.count, 23, 'should return everything in the drive');
        assert.notEqual(rootSubfolderIndex, -1, 'rootSubfolder1 should exist');
    });

    it('Finds all text files', async () => {
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

describe('Search files with parent path', () => {
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

    it(`Finds all files and folders in /${parentPaths.rootSubfolder1} recursively`, async () => {
        const totalFiles = 12;

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

    it(`Finds all files and folders in /${parentPaths.rootSubfolder2} recursively`, async () => {
        const totalFiles = 6;

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

    it(`Finds all files and folders in /${parentPaths.subfolder1Subfolder} recursively`, async () => {
        const totalFiles = 6;

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

    it(`Finds all files in /${parentPaths.rootSubfolder1} recursively with name 'testImage'`, async () => {
        const totalFiles = 2;

        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    parentPath: parentPaths.rootSubfolder1,
                    q: 'testImage'
                }
            }
        };

        await action.receive(context);

        const [data, outportName] = context.sendJson.args[0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.notDeepStrictEqual(data, {}, 'should NOT be an empty object');
        assert.equal(outportName, 'out', "should be sent to 'out' output port");
        assert.equal(data.count, totalFiles, `should return ${totalFiles} files in total`);
        assert.equal(data.result[0].name.includes('testImage'), true, `file 1 name should contain 'testImage'`);
        assert.equal(data.result[1].name.includes('testImage'), true, `file 2 name should contain 'testImage'`);
    });

    it(`Finds all files in /${parentPaths.rootSubfolder1} recursively with name 'testExcel'`, async () => {
        const totalFiles = 2;

        context.messages = {
            in: {
                content: {
                    ...context.messages.in.content,
                    parentPath: parentPaths.rootSubfolder1,
                    q: 'testExcel'
                }
            }
        };

        await action.receive(context);

        const [data, outportName] = context.sendJson.args[0];

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.notDeepStrictEqual(data, {}, 'should NOT be an empty object');
        assert.equal(outportName, 'out', "should be sent to 'out' output port");
        assert.equal(data.count, totalFiles, `should return ${totalFiles} files in total`);
        assert.equal(data.result[0].name.includes('testExcel'), true, `file 1 name should contain 'testExcel'`);
        assert.equal(data.result[1].name.includes('testExcel'), true, `file 2 name should contain 'testExcel'`);
    });

    it(`Finds all files in /${parentPaths.rootSubfolder1} recursively with name 'rootSubfolder2'`, async () => {
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

        assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
        assert.deepStrictEqual(data, {}, 'should be an empty object');
        assert.equal(outportName, 'notFound', 'should be sent to notFound output port');
    });
});

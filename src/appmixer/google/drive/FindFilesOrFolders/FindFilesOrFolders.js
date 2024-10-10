/* eslint-disable quotes */

'use strict';
const { google } = require('googleapis');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        const auth = lib.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { query, searchType, folderLocation, fileTypes, outputType } = context.messages.in.content;
        const escapedQuery = lib.escapeSpecialCharacters(query);

        let folderId;
        if (folderLocation) {
            folderId = typeof folderLocation === 'string' ? folderLocation : folderLocation.id;
        }

        const queryParentsSuffix = folderLocation ? ` and '${folderId}' in parents` : '';
        const querySuffix = ' and trashed=false' + queryParentsSuffix;
        const queryFolderSuffix = ' and mimeType = \'application/vnd.google-apps.folder\'';
        const queryFileSuffix = ' and mimeType != \'application/vnd.google-apps.folder\'';

        let q;
        if (searchType === 'fileNameExact') {
            q = `name='${escapedQuery}'` + querySuffix + queryFileSuffix;
        } else if (searchType === 'fileNameContains') {
            q = `name contains '${escapedQuery}'` + querySuffix + queryFileSuffix;
        } else if (searchType === 'folderNameExact') {
            q = `name='${escapedQuery}'` + querySuffix + queryFolderSuffix;
        } else if (searchType === 'folderNameContains') {
            q = `name contains '${escapedQuery}'` + querySuffix + queryFolderSuffix;
        } else if (searchType === 'fullText') {
            q = `fullText contains '${escapedQuery}'` + querySuffix;
        } else {
            q = query;  // no query suffix, this is a completely custom search.
        }

        if (fileTypes && fileTypes.length) {
            const mimeTypeQuery = fileTypes.map(fileType => `mimeType contains '${fileType}'`).join(' or ');
            q += ` and (${mimeTypeQuery})`;
        }

        const pageSize = outputType === 'firstItem' ? 1 : 1000;

        // First page.
        const { data } = await drive.files.list({ q, fields: '*', pageSize });

        // While there are more pages, keep fetching them.
        while (data.nextPageToken) {
            const nextPage = await drive.files.list({ q, pageToken: data.nextPageToken, pageSize, fields: '*' });
            data.files = data.files.concat(nextPage.data.files);
            data.nextPageToken = nextPage.data.nextPageToken;
        }

        const { files = [] } = data;
        const items = files.map(this.prepareOutputItem);

        if (items.length === 0) {
            return context.sendJson({ query }, 'notFound');
        }

        if (outputType === 'firstItem') {
            // First item only.
            if (items.length > 0) {
                return context.sendJson(items[0], 'out');
            }
        } else if (outputType === 'item') {
            // One by one.
            return context.sendArray(items, 'out');
        } else if (outputType === 'items') {
            // All at once.
            return context.sendJson({ items }, 'out');
        } else if (outputType === 'file') {
            // Into CSV file.
            // Expand objects first level (googleDriveFileMetadata) to columns.
            const firstItem = items[0];
            let headers = [];
            Object.keys(firstItem).map(key => {
                if (firstItem[key] && typeof firstItem[key] === 'object') {
                    headers = headers.concat(Object.keys(firstItem[key]).map(subKey => `${key}.${subKey}`));
                } else {
                    headers.push(key);
                }
            });
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const file of items) {
                const values = headers.map(header => {
                    let val;
                    if (header.includes('.')) {
                        const [key, subKey] = header.split('.');
                        val = file[key][subKey];
                    } else {
                        val = file[header];
                    }
                    if (typeof val === 'object' || Array.isArray(val)) {
                        val = JSON.stringify(val);
                    }
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const savedFile = await context.saveFileStream(`google-drive-FindFilesOrFolders-${(new Date).toISOString()}.csv`, buffer);
            return context.sendJson({ fileId: savedFile.fileId, count: items.count }, 'out');
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    prepareOutputItem(item, index, items) {
        return {
            index: index,
            count: items.length,
            isFolder: item.mimeType === 'application/vnd.google-apps.folder',
            isFile: item.mimeType !== 'application/vnd.google-apps.folder',
            googleDriveFileMetadata: item
        };
    },

    getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;
        if (outputType === 'item' || outputType === 'firstItem') {
            const options = [
                { "label": "Current Item Index", "value": "index", "schema": { "type": "integer" } },
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                { "label": "Is File", "value": "isFile", "schema": { "type": "boolean" } },
                { "label": "Is Folder", "value": "isFolder", "schema": { "type": "boolean" }  },
                {
                    "label": "GDrive File Metadata",
                    "value": "googleDriveFileMetadata",
                    "schema": this.googleDriveFileMetadataSchema
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'items') {
            const options = [
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                { label: 'Items', value: 'items', "schema": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "index": { "type": "integer", "title": "Current Item Index" },
                            "isFile": { "type": "boolean", "title": "Is File" },
                            "isFolder": { "type": "boolean", "title": "Is Folder" },
                            "googleDriveFileMetadata": this.googleDriveFileMetadataSchema
                        }
                    }
                } }
            ];
            return context.sendJson(options, 'out');
        } else {        // file
            return context.sendJson([
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                { label: 'File ID', value: 'fileId', "schema": { "type": "string", "format": "appmixer-file-id" } }
            ], 'out');
        }
    },

    googleDriveFileMetadataSchema: {
        "type": "object",
        "properties": {
            "id": {
                "type": "string",
                "description": "The ID of the file.",
                "title": "GDrive File.ID"
            },
            "name": {
                "type": "string",
                "description": "The name of the file.",
                "title": "GDrive File.Name"
            },
            "mimeType": {
                "type": "string",
                "description": "The MIME type of the file.",
                "title": "GDrive File.MIME Type"
            },
            "description": {
                "type": "string",
                "description": "A short description of the file.",
                "title": "GDrive File.Description"
            },
            "starred": {
                "type": "boolean",
                "description": "Whether the file has been starred by the user.",
                "title": "GDrive File.Starred"
            },
            "trashed": {
                "type": "boolean",
                "description": "Whether the file has been trashed.",
                "title": "GDrive File.Trashed"
            },
            "kind": {
                "type": "string",
                "description": "Identifies what kind of resource this is. Value: the fixed string 'drive#file'.",
                "title": "GDrive File.Kind"
            },
            "webViewLink": {
                "type": "string",
                "description": "A link for opening the file in a relevant Google editor or viewer in a browser.",
                "title": "GDrive File.Web View Link"
            },
            "webContentLink": {
                "type": "string",
                "description": "A link for downloading the content of the file in a browser.",
                "title": "GDrive File.Web Content Link"
            },
            "driveId": {
                "type": "string",
                "description": "The ID of the drive.",
                "title": "GDrive File.Drive ID"
            },
            "fileExtension": {
                "type": "string",
                "title": "GDrive File.Extension"
            },
            "size": {
                "type": "string",
                "title": "GDrive File.Size"
            },
            "iconLink": {
                "type": "string",
                "description": "A link to the file's icon.",
                "title": "GDrive File.Icon Link"
            },
            "thumbnailLink": {
                "type": "string",
                "description": "A short-lived link to the file's thumbnail, if available.",
                "title": "GDrive File.Thumbnail Link"
            },
            "md5Checksum": {
                "type": "string",
                "title": "GDrive File.MD5 Checksum"
            },
            "sha1Checksum": {
                "type": "string",
                "title": "GDrive File.SHA1 Checksum"
            },
            "sha256Checksum": {
                "type": "string",
                "title": "GDrive File.SHA256 Checksum"
            },
            "writersCanShare": {
                "type": "boolean",
                "title": "GDrive File.Writers Can Share"
            },
            "exportLinks": {
                "type": "object",
                "title": "GDrive File.Export Links",
                "description": "Links for exporting Docs Editors files to specific formats."
            },
            "properties": {
                "type": "object",
                "title": "GDrive File.Properties"
            },
            "appProperties": {
                "type": "object",
                "title": "GDrive File.App Properties"
            },
            "copyRequiresWriterPermission": {
                "type": "boolean",
                "title": "GDrive File.Copy Requires Writer Permission",
                "description": "Whether the options to copy, print, or download this file, should be disabled for readers and commenters."
            },
            "isAppAuthorized": {
                "type": "boolean",
                "description": "Whether the file was created or opened by the requesting app.",
                "title": "GDrive File.Is App Authorized"
            },
            "hasAugmentedPermissions": {
                "type": "boolean",
                "description": "Whether there are permissions directly on this file.",
                "title": "GDrive File.Has Augmented Permissions"
            },
            "originalFilename": {
                "type": "string",
                "description": "The original filename of the uploaded content if available, or else the original value of the name field. This is only available for files with binary content in Google Drive.",
                "title": "GDrive File.Original Filename"
            },
            "explicitlyTrashed": {
                "type": "boolean",
                "description": "Whether the file has been explicitly trashed.",
                "title": "GDrive File.Explicitly Trashed"
            },
            "parents": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "description": "The IDs of the parent folders which contain the file.",
                "title": "GDrive File.Parents"
            },
            "spaces": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "description": "The spaces which contain the file.",
                "title": "GDrive File.Spaces"
            },
            "permissionIds": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "description": "List of permission IDs for users with access to this file.",
                "title": "GDrive File.Permission IDs"
            },
            "version": {
                "type": "integer",
                "description": "A monotonically increasing version number for the file.",
                "title": "GDrive File.Version"
            },
            "folderColorRgb": {
                "type": "string",
                "description": "The color for a folder or a shortcut to a folder as an RGB hex string.",
                "title": "GDrive File.Folder Color RGB"
            },
            "resourceKey": {
                "type": "string",
                "description": "A key needed to access the item via a shared link.",
                "title": "GDrive File.Resource Key"
            },
            "linkShareMetadata": {
                "type": "object",
                "properties": {
                    "securityUpdateEligible": {
                        "title": "GDrive File.Link Share Metadata.Security Update Eligible",
                        "type": "boolean"
                    },
                    "securityUpdateEnabled": {
                        "title": "GDrive File.Link Share Metadata.Security Update Enabled",
                        "type": "boolean"
                    }
                },
                "description": "Contains details about the link URLs that clients are using to refer to this item.",
                "title": "GDrive File.Link Share Metadata"
            },
            "labelInfo": {
                "type": "object",
                "properties": {
                    "labels": {
                        "title": "GDrive File.Label Info.Labels",
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": { "type": "string" },
                                "revisionId": { "type": "string" },
                                "kind": { "type": "string" },
                                "fields": { "type": "object" }
                            }
                        }
                    }
                },
                "description": "An overview of the labels on the file.",
                "title": "GDrive File.Label Info"
            },
            "hasThumbnail": {
                "type": "boolean",
                "description": "Whether the file has a thumbnail.",
                "title": "GDrive File.Has Thumbnail"
            },
            "thumbnailVersion": {
                "type": "string",
                "description": "The thumbnail version for use in thumbnail cache invalidation.",
                "title": "GDrive File.Thumbnail Version"
            },
            "trashedTime": {
                "type": "string",
                "format": "date-time",
                "description": "The time that the item was trashed.",
                "title": "GDrive File.Trashed Time"
            },
            "fullFileExtension": {
                "type": "string",
                "description": "The full file extension extracted from the name field. May contain multiple concatenated extensions, such as \"tar.gz\". This is only available for files with binary content in Google Drive.",
                "title": "GDrive File.Full File Extension"
            },
            "viewedByMe": {
                "type": "boolean",
                "description": "Whether the file has been viewed by the user.",
                "title": "GDrive File.Viewed By Me"
            },
            "ownedByMe": {
                "type": "boolean",
                "description": "Whether the user owns the file.",
                "title": "GDrive File.Owned By Me"
            },
            "viewedByMeTime": {
                "type": "string",
                "format": "date-time",
                "description": "The last time the file was viewed by the user.",
                "title": "GDrive File.Viewed By Me Time"
            },
            "createdTime": {
                "type": "string",
                "format": "date-time",
                "description": "The time at which the file was created.",
                "title": "GDrive File.Created Time"
            },
            "modifiedTime": {
                "type": "string",
                "format": "date-time",
                "description": "The last time the file was modified by anyone.",
                "title": "GDrive File.Modified Time"
            },
            "modifiedByMeTime": {
                "type": "string",
                "format": "date-time",
                "description": "The last time the file was modified by the user.",
                "title": "GDrive File.Modified By Me Time"
            },
            "modifiedByMe": {
                "type": "boolean",
                "description": "Whether the file has been modified by this user.",
                "title": "GDrive File.Modified By"
            },
            "sharedWithMeTime": {
                "type": "string",
                "format": "date-time",
                "description": "The time at which the file was shared with the user.",
                "title": "GDrive File.Shared With Me Time"
            },
            "quotaBytesUsed": {
                "type": "string",
                "description": "The number of storage quota bytes used by the file.",
                "title": "GDrive File.Quota Bytes Used"
            },
            "permissions": {
                "title": "GDrive File.Permissions",
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string"
                        },
                        "displayName": {
                            "type": "string"
                        },
                        "type": {
                            "type": "string"
                        },
                        "kind": {
                            "type": "string"
                        },
                        "permissionDetails": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "permissionType": { "type": "string" },
                                    "inheritedFrom": { "type": "string" },
                                    "role": { "type": "string" },
                                    "inherited": { "type": "boolean" }
                                }
                            }
                        },
                        "teamDrivePermissionDetails": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "teamDrivePermissionType": { "type": "string" },
                                    "inheritedFrom": { "type": "string" },
                                    "role": { "type": "string" },
                                    "inherited": { "type": "boolean" }
                                }
                            }
                        },
                        "photoLink": {
                            "type": "string"
                        },
                        "emailAddress": {
                            "type": "string"
                        },
                        "role": {
                            "type": "string"
                        },
                        "allowFileDiscovery": {
                            "type": "boolean"
                        },
                        "domain": {
                            "type": "string"
                        },
                        "expirationTime": {
                            "type": "string"
                        },
                        "deleted": {
                            "type": "boolean"
                        },
                        "view": {
                            "type": "string"
                        },
                        "pendingOwner": {
                            "type": "boolean"
                        }
                    }
                }
            },
            "contentRestrictions": {
                "title": "GDrive File.Content Restrictions",
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "readOnly": {
                            "type": "boolean",
                            "description": "Whether the content is read-only."
                        },
                        "reason": {
                            "type": "string",
                            "description": "The reason for the restriction."
                        },
                        "type": {
                            "type": "string",
                            "description": "The type of restriction."
                        },
                        "restrictingUser": {
                            "type": "object",
                            "description": "The user who applied the restriction.",
                            "properties": {
                                "kind": {
                                    "type": "string",
                                    "description": "Identifies the user."
                                },
                                "displayName": {
                                    "type": "string",
                                    "description": "The name of the user."
                                },
                                "photoLink": {
                                    "type": "string",
                                    "description": "A link to the user's profile photo."
                                },
                                "me": {
                                    "type": "boolean",
                                    "description": "Whether this is the authenticated user."
                                },
                                "permissionId": {
                                    "type": "string",
                                    "description": "The user's ID."
                                },
                                "emailAddress": {
                                    "type": "string",
                                    "description": "The email address of the user."
                                }
                            },
                            "required": ["kind", "displayName"]
                        },
                        "restrictionTime": {
                            "type": "string",
                            "description": "The time when the restriction was applied.",
                            "format": "date-time"
                        },
                        "ownerRestricted": {
                            "type": "boolean",
                            "description": "Whether the owner applied the restriction."
                        },
                        "systemRestricted": {
                            "type": "boolean",
                            "description": "Whether the restriction was applied by the system."
                        }
                    }
                }
            },
            "shortcutDetails": {
                "title": "GDrive File.Shortcut Details",
                "type": "object",
                "properties": {
                    "targetId": {
                        "title": "GDrive File.Shortcut Details.Target ID",
                        "type": "string",
                        "description": "The ID of the target file."
                    },
                    "targetMimeType": {
                        "title": "GDrive File.Shortcut Details.Target MIME Type",
                        "type": "string",
                        "description": "The MIME type of the target file."
                    },
                    "targetResourceKey": {
                        "title": "GDrive File.Shortcut Details.Target Resource Key",
                        "type": "string",
                        "description": "The resource key of the target file."
                    }
                }
            },
            "videoMediaMetadata": {
                "title": "GDrive File.Video Media Metadata",
                "type": "object",
                "properties": {
                    "width": {
                        "title": "GDrive File.Video Media Metadata.Width",
                        "type": "integer",
                        "description": "The width of the video in pixels."
                    },
                    "height": {
                        "title": "GDrive File.Video Media Metadata.Height",
                        "type": "integer",
                        "description": "The height of the video in pixels."
                    },
                    "durationMillis": {
                        "title": "GDrive File.Video Media Metadata.Duration Millis",
                        "type": "string",
                        "description": "The duration of the video in milliseconds."
                    }
                }
            },
            "imageMediaMetadata": {
                "title": "GDrive File.Image Media Metadata",
                "type": "object",
                "properties": {
                    "flashUsed": {
                        "title": "GDrive File.Image Media Metadata.Flash Used",
                        "type": "boolean",
                        "description": "Indicates whether the flash was used."
                    },
                    "meteringMode": {
                        "title": "GDrive File.Image Media Metadata.Metering Mode",
                        "type": "string",
                        "description": "The metering mode used."
                    },
                    "sensor": {
                        "title": "GDrive File.Image Media Metadata.Sensor",
                        "type": "string",
                        "description": "The type of sensor used."
                    },
                    "exposureMode": {
                        "title": "GDrive File.Image Media Metadata.Exposure Mode",
                        "type": "string",
                        "description": "The exposure mode used."
                    },
                    "colorSpace": {
                        "title": "GDrive File.Image Media Metadata.Color Space",
                        "type": "string",
                        "description": "The color space used."
                    },
                    "whiteBalance": {
                        "title": "GDrive File.Image Media Metadata.White Balance",
                        "type": "string",
                        "description": "The white balance setting."
                    },
                    "width": {
                        "title": "GDrive File.Image Media Metadata.Width",
                        "type": "integer",
                        "description": "The width of the image in pixels."
                    },
                    "height": {
                        "title": "GDrive File.Image Media Metadata.Height",
                        "type": "integer",
                        "description": "The height of the image in pixels."
                    },
                    "location": {
                        "title": "GDrive File.Image Media Metadata.Location",
                        "type": "object",
                        "properties": {
                            "latitude": {
                                "title": "GDrive File.Image Media Metadata.Location.Latitude",
                                "type": "number",
                                "description": "The latitude where the photo was taken."
                            },
                            "longitude": {
                                "title": "GDrive File.Image Media Metadata.Location.Longitude",
                                "type": "number",
                                "description": "The longitude where the photo was taken."
                            },
                            "altitude": {
                                "title": "GDrive File.Image Media Metadata.Location.Altitude",
                                "type": "number",
                                "description": "The altitude where the photo was taken."
                            }
                        }
                    },
                    "rotation": {
                        "title": "GDrive File.Image Media Metadata.Rotation",
                        "type": "integer",
                        "description": "The rotation of the image in degrees."
                    },
                    "time": {
                        "title": "GDrive File.Image Media Metadata.Time",
                        "type": "string",
                        "description": "The time the photo was taken."
                    },
                    "cameraMake": {
                        "title": "GDrive File.Image Media Metadata.Camera Make",
                        "type": "string",
                        "description": "The make of the camera."
                    },
                    "cameraModel": {
                        "title": "GDrive File.Image Media Metadata.Camera Model",
                        "type": "string",
                        "description": "The model of the camera."
                    },
                    "exposureTime": {
                        "title": "GDrive File.Image Media Metadata.Exposure Time",
                        "type": "number",
                        "description": "The exposure time in seconds."
                    },
                    "aperture": {
                        "title": "GDrive File.Image Media Metadata.Aperture",
                        "type": "number",
                        "description": "The aperture value."
                    },
                    "focalLength": {
                        "title": "GDrive File.Image Media Metadata.Focal Length",
                        "type": "number",
                        "description": "The focal length of the lens in millimeters."
                    },
                    "isoSpeed": {
                        "title": "GDrive File.Image Media Metadata.ISO Speed",
                        "type": "integer",
                        "description": "The ISO speed."
                    },
                    "exposureBias": {
                        "title": "GDrive File.Image Media Metadata.Exposure Bias",
                        "type": "number",
                        "description": "The exposure bias."
                    },
                    "maxApertureValue": {
                        "title": "GDrive File.Image Media Metadata.Max Aperture Value",
                        "type": "number",
                        "description": "The maximum aperture value."
                    },
                    "subjectDistance": {
                        "title": "GDrive File.Image Media Metadata.Subject Distance",
                        "type": "integer",
                        "description": "The distance to the subject in meters."
                    },
                    "lens": {
                        "title": "GDrive File.Image Media Metadata.Lens",
                        "type": "string",
                        "description": "The lens used."
                    }
                }
            },
            "capabilities": {
                "title": "GDrive File.Capabilities",
                "type": "object",
                "properties": {
                    "canChangeViewersCanCopyContent": {
                        "title": "GDrive File.Capabilities.Can Change Viewers Can Copy Content",
                        "type": "boolean",
                        "description": "Whether the user can change if viewers can copy content."
                    },
                    "canMoveChildrenOutOfDrive": {
                        "title": "GDrive File.Capabilities.Can Move Children Out Of Drive",
                        "type": "boolean",
                        "description": "Whether the user can move children out of Google Drive."
                    },
                    "canReadDrive": {
                        "title": "GDrive File.Capabilities.Can Read Drive",
                        "type": "boolean",
                        "description": "Whether the user can read the Drive."
                    },
                    "canEdit": {
                        "title": "GDrive File.Capabilities.Can Edit",
                        "type": "boolean",
                        "description": "Whether the user can edit the file."
                    },
                    "canCopy": {
                        "title": "GDrive File.Capabilities.Can Copy",
                        "type": "boolean",
                        "description": "Whether the user can copy the file."
                    },
                    "canComment": {
                        "title": "GDrive File.Capabilities.Can Comment",
                        "type": "boolean",
                        "description": "Whether the user can comment on the file."
                    },
                    "canAddChildren": {
                        "title": "GDrive File.Capabilities.Can Add Children",
                        "type": "boolean",
                        "description": "Whether the user can add children to the file."
                    },
                    "canDelete": {
                        "title": "GDrive File.Capabilities.Can Delete",
                        "type": "boolean",
                        "description": "Whether the user can delete the file."
                    },
                    "canDownload": {
                        "title": "GDrive File.Capabilities.Can Download",
                        "type": "boolean",
                        "description": "Whether the user can download the file."
                    },
                    "canListChildren": {
                        "title": "GDrive File.Capabilities.Can List Children",
                        "type": "boolean",
                        "description": "Whether the user can list children of the file."
                    },
                    "canRemoveChildren": {
                        "title": "GDrive File.Capabilities.Can Remove Children",
                        "type": "boolean",
                        "description": "Whether the user can remove children from the file."
                    },
                    "canRename": {
                        "title": "GDrive File.Capabilities.Can Rename",
                        "type": "boolean",
                        "description": "Whether the user can rename the file."
                    },
                    "canTrash": {
                        "title": "GDrive File.Capabilities.Can Trash",
                        "type": "boolean",
                        "description": "Whether the user can move the file to trash."
                    },
                    "canReadRevisions": {
                        "title": "GDrive File.Capabilities.Can Read Revisions",
                        "type": "boolean",
                        "description": "Whether the user can read revisions of the file."
                    },
                    "canReadTeamDrive": {
                        "title": "GDrive File.Capabilities.Can Read Team Drive",
                        "type": "boolean",
                        "description": "Whether the user can read the Team Drive."
                    },
                    "canMoveTeamDriveItem": {
                        "title": "GDrive File.Capabilities.Can Move Team Drive Item",
                        "type": "boolean",
                        "description": "Whether the user can move items within Team Drive."
                    },
                    "canChangeCopyRequiresWriterPermission": {
                        "title": "GDrive File.Capabilities.Can Change Copy Requires Writer Permission",
                        "type": "boolean",
                        "description": "Whether the user can change the setting that copy requires writer permission."
                    },
                    "canMoveItemIntoTeamDrive": {
                        "title": "GDrive File.Capabilities.Can Move Item Into Team Drive",
                        "type": "boolean",
                        "description": "Whether the user can move the item into Team Drive."
                    },
                    "canUntrash": {
                        "title": "GDrive File.Capabilities.Can Untrash",
                        "type": "boolean",
                        "description": "Whether the user can restore the file from trash."
                    },
                    "canModifyContent": {
                        "title": "GDrive File.Capabilities.Can Modify Content",
                        "type": "boolean",
                        "description": "Whether the user can modify the content of the file."
                    },
                    "canMoveItemWithinTeamDrive": {
                        "title": "GDrive File.Capabilities.Can Move Item Within Team Drive",
                        "type": "boolean",
                        "description": "Whether the user can move the item within Team Drive."
                    },
                    "canMoveItemOutOfTeamDrive": {
                        "title": "GDrive File.Capabilities.Can Move Item Out Of Team Drive",
                        "type": "boolean",
                        "description": "Whether the user can move the item out of Team Drive."
                    },
                    "canDeleteChildren": {
                        "title": "GDrive File.Capabilities.Can Delete Children",
                        "type": "boolean",
                        "description": "Whether the user can delete children of the file."
                    },
                    "canMoveChildrenOutOfTeamDrive": {
                        "title": "GDrive File.Capabilities.Can Move Children Out Of Team Drive",
                        "type": "boolean",
                        "description": "Whether the user can move children out of Team Drive."
                    },
                    "canMoveChildrenWithinTeamDrive": {
                        "title": "GDrive File.Capabilities.Can Move Children Within Team Drive",
                        "type": "boolean",
                        "description": "Whether the user can move children within Team Drive."
                    },
                    "canTrashChildren": {
                        "title": "GDrive File.Capabilities.Can Trash Children",
                        "type": "boolean",
                        "description": "Whether the user can move children to trash."
                    },
                    "canMoveItemOutOfDrive": {
                        "title": "GDrive File.Capabilities.Can Move Item Out Of Drive",
                        "type": "boolean",
                        "description": "Whether the user can move the item out of Google Drive."
                    },
                    "canAddMyDriveParent": {
                        "title": "GDrive File.Capabilities.Can Add My Drive Parent",
                        "type": "boolean",
                        "description": "Whether the user can add a My Drive parent to the file."
                    },
                    "canRemoveMyDriveParent": {
                        "title": "GDrive File.Capabilities.Can Remove My Drive Parent",
                        "type": "boolean",
                        "description": "Whether the user can remove a My Drive parent from the file."
                    },
                    "canMoveItemWithinDrive": {
                        "title": "GDrive File.Capabilities.Can Move Item Within Drive",
                        "type": "boolean",
                        "description": "Whether the user can move the item within Google Drive."
                    },
                    "canShare": {
                        "title": "GDrive File.Capabilities.Can Share",
                        "type": "boolean",
                        "description": "Whether the user can share the file."
                    },
                    "canMoveChildrenWithinDrive": {
                        "title": "GDrive File.Capabilities.Can Move Children Within Drive",
                        "type": "boolean",
                        "description": "Whether the user can move children within Google Drive."
                    },
                    "canModifyContentRestriction": {
                        "title": "GDrive File.Capabilities.Can Modify Content Restriction",
                        "type": "boolean",
                        "description": "Whether the user can modify content restrictions."
                    },
                    "canAddFolderFromAnotherDrive": {
                        "title": "GDrive File.Capabilities.Can Add Folder From Another Drive",
                        "type": "boolean",
                        "description": "Whether the user can add a folder from another Drive."
                    },
                    "canChangeSecurityUpdateEnabled": {
                        "title": "GDrive File.Capabilities.Can Change Security Update Enabled",
                        "type": "boolean",
                        "description": "Whether the user can change the security update setting."
                    },
                    "canAcceptOwnership": {
                        "title": "GDrive File.Capabilities.Can Accept Ownership",
                        "type": "boolean",
                        "description": "Whether the user can accept ownership of the file."
                    },
                    "canReadLabels": {
                        "title": "GDrive File.Capabilities.Can Read Labels",
                        "type": "boolean",
                        "description": "Whether the user can read labels on the file."
                    },
                    "canModifyLabels": {
                        "title": "GDrive File.Capabilities.Can Modify Labels",
                        "type": "boolean",
                        "description": "Whether the user can modify labels on the file."
                    },
                    "canModifyEditorContentRestriction": {
                        "title": "GDrive File.Capabilities.Can Modify Editor Content Restriction",
                        "type": "boolean",
                        "description": "Whether the user can modify editor content restrictions."
                    },
                    "canModifyOwnerContentRestriction": {
                        "title": "GDrive File.Capabilities.Can Modify Owner Content Restriction",
                        "type": "boolean",
                        "description": "Whether the user can modify owner content restrictions."
                    },
                    "canRemoveContentRestriction": {
                        "title": "GDrive File.Capabilities.Can Remove Content Restriction",
                        "type": "boolean",
                        "description": "Whether the user can remove content restrictions."
                    }
                }
            },
            "lastModifyingUser": {
                "title": "GDrive File.Last Modifying User",
                "type": "object",
                "properties": {
                    "kind": {
                        "title": "GDrive File.Last Modifying User.Kind",
                        "type": "string"
                    },
                    "displayName": {
                        "title": "GDrive File.Last Modifying User.Display Name",
                        "type": "string"
                    },
                    "photoLink": {
                        "title": "GDrive File.Last Modifying User.Photo Link",
                        "type": "string"
                    },
                    "me": {
                        "title": "GDrive File.Last Modifying User.Me",
                        "type": "boolean"
                    },
                    "permissionId": {
                        "title": "GDrive File.Last Modifying User.Permission Id",
                        "type": "string"
                    },
                    "emailAddress": {
                        "title": "GDrive File.Last Modifying User.Email Address",
                        "type": "string"
                    }
                },
                "description": "The user who last modified the file."
            },
            "sharingUser": {
                "title": "GDrive File.Sharing User",
                "type": "object",
                "properties": {
                    "kind": {
                        "title": "GDrive File.Sharing User.Kind",
                        "type": "string"
                    },
                    "displayName": {
                        "title": "GDrive File.Sharing User.Display Name",
                        "type": "string"
                    },
                    "photoLink": {
                        "title": "GDrive File.Sharing User.Photo Link",
                        "type": "string"
                    },
                    "me": {
                        "title": "GDrive File.Sharing User.Me",
                        "type": "boolean"
                    },
                    "permissionId": {
                        "title": "GDrive File.Sharing User.Permission Id",
                        "type": "string"
                    },
                    "emailAddress": {
                        "title": "GDrive File.Sharing User.Email Address",
                        "type": "string"
                    }
                },
                "description": "The user who shared the file with the requesting user, if applicable."
            },
            "trashingUser": {
                "title": "GDrive File.Trashing User",
                "type": "object",
                "properties": {
                    "kind": {
                        "title": "GDrive File.Trashing User.Kind",
                        "type": "string"
                    },
                    "displayName": {
                        "title": "GDrive File.Trashing User.Display Name",
                        "type": "string"
                    },
                    "photoLink": {
                        "title": "GDrive File.Trashing User.Photo Link",
                        "type": "string"
                    },
                    "me": {
                        "title": "GDrive File.Trashing User.Me",
                        "type": "boolean"
                    },
                    "permissionId": {
                        "title": "GDrive File.Trashing User.Permission Id",
                        "type": "string"
                    },
                    "emailAddress": {
                        "title": "GDrive File.Trashing User.Email Address",
                        "type": "string"
                    }
                },
                "description": "If the file has been explicitly trashed, the user who trashed it."
            },
            "headRevisionId": {
                "title": "GDrive File.Head Revision ID",
                "type": "string"
            },
            "shared": {
                "title": "GDrive File.Shared",
                "type": "boolean",
                "description": "Whether the file has been shared."
            },
            "owners": {
                "title": "GDrive File.Owners",
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "kind": {
                            "type": "string",
                            "description": "Identifies what kind of resource this is. Value: the fixed string 'drive#user'."
                        },
                        "displayName": {
                            "type": "string",
                            "description": "The display name of the user."
                        },
                        "photoLink": {
                            "type": "string",
                            "description": "A link to the user's profile photo, if available."
                        },
                        "me": {
                            "type": "boolean",
                            "description": "Whether this user is the authenticated user for whom the request is being made."
                        },
                        "permissionId": {
                            "type": "string",
                            "description": "The user's ID as visible in Permission resources."
                        },
                        "emailAddress": {
                            "type": "string",
                            "description": "The email address of the user."
                        }
                    },
                    "required": ["kind", "displayName", "permissionId", "emailAddress"],
                    "description": "The owners of the file."
                },
                "description": "The owners of the file."
            }
        }
    }
};

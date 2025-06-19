---
mode: 'agent'
description: "You are a code generator. Your task is to complete the provided code template to make it a working component."
---

# What to process
List of components to generate:
- each component where its `**/appmixer/**/component.json` has `genv2` key
- the path is relative to the root of the repository

# Processing instructions for behavior files
- Properly structure the `context.httpRequest` call which is `axios` under the hood.
    - Use the inputs from `context.messages.in.content` in the request body, header, or query parameters as appropriate.
    - Use auth from [auth.js](${fileDirname}/../auth.js) for more context. Avoid requiring it in the behavior file.
    - Focus on authorization headers using context from auth.js file.
- Remove any unused requires to `lib.js` or `lib.generated`.
- Always add 'use strict'; (single quotes) at the top of the behavior file, followed by an empty line.
- When working with snake_case keys in `context.messages.in.content`, add `/* eslint-disable camelcase */` at the top of the behavior file to disable camelCase linting.
- It is ok to send undefined values in `context.httpRequest`.
- Components that do DELETE or PATCH requests should return `context.sendJson({}, 'out');` to indicate success.
- If the result of the API call is a file:
  - add comment `Returning file` before `context.sendJson()` call.
  - decide whether in `context.httpRequest` to use `responseType: 'arraybuffer'` or `responseType: 'stream'` based on the API documentation.
  - use this code to save the file into Appmixer and return its metadata:
```javascript
// For example: 1701980838697_elevenlabs_createSpeechSynthesis
const filename = `${Date.now()}_${context.componentType.split('.')[1]}_${context.componentType.split('.')[3]}`;
const file = await context.saveFileStream(filename, data); // data is a binary buffer
return context.sendJson({ fileId: file.fileId, fileSize: file.length }, 'out');
```

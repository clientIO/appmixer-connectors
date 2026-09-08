"use strict";

const lib = require("../../lib");

module.exports = {
  receive: async function (context) {
    let { sampleId, cloneProjectName, companyId } = context.messages.in.content;

    // Prepare request body with all fields
    const requestBody = {};

    if (sampleId !== undefined) {
      requestBody.templateId = sampleId;
    }
    if (cloneProjectName !== undefined) {
      requestBody.cloneProjectName = cloneProjectName;
    }
    if (companyId !== undefined) {
      requestBody.companyId = companyId;
    }

    try {
      let resp = await lib.callAPI(
        context,
        "POST",
        "/projects/sample.json",
        requestBody,
        null
      );

      await context.sendJson({ project: resp }, "project");
      return context.response({});
    } catch (error) {
      throw new Error(`Error creating project from sample: ${error.message}`);
    }
  },
};

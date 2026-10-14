"use strict";

const lib = require("../../lib");

module.exports = {
  receive: async function (context) {
    let {
      templateId,
      cloneProjectName,
      companyId,
    } = context.messages.in.content;

    // Validate required fields
    if (!templateId) {
      throw new Error("Missing required field: templateId is required");
    }

    // Prepare request body with all fields
    const requestBody = {};

    // Helper function to add field if defined
    const addField = (key, value) => {
      if (value !== undefined) {
        requestBody[key] = value;
      }
    };

    // Add all provided fields to the request body
    addField("newFromTemplate", true);
    addField("cloneproject-action", "copy");
    addField("cloneProjectName", cloneProjectName);
    addField("toTemplate", false);
    addField("companyId", companyId);

    try {
      // Construct the URL with templateId as a path parameter
      const url = `/projects/${templateId}/clone.json`;

      let resp = await lib.callAPI(context, "POST", url, requestBody, null);

      await context.sendJson({ project: resp }, "project");
      return context.response({});
    } catch (error) {
      throw new Error(`Error creating project from template: ${error.message}`);
    }
  },
};

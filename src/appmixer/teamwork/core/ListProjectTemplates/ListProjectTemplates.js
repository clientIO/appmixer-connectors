"use strict";

const lib = require("../../lib");

module.exports = {
  receive: async function (context) {
    try {
      let resp = await lib.callAPI(
        context,
        "GET",
        "/projects/api/v3/projects/templates.json",
        null,
        null
      );

      // The API returns { "projects": [...] }
      // Extract the projects array and send it
      if (resp && Array.isArray(resp.projects)) {
        return context.sendJson({ projects: resp.projects }, "projects");
      } else {
        throw new Error(
          "Invalid API response structure: expected projects array"
        );
      }
    } catch (error) {
      throw new Error(`Error fetching project templates: ${error.message}`);
    }
  },

  toInspector: function (data) {
    let transformed = [];
    if (data && Array.isArray(data.projects)) {
      data.projects.forEach((project) => {
        transformed.push({
          label: project.name,
          value: project.id.toString(),
        });
      });
    }

    return transformed;
  },
};

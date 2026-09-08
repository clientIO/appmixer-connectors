"use strict";

const lib = require("../../lib");

module.exports = {
    receive: async function (context) {
        let { 
            companyId, 
            name, 
            people, 
            tentative,
            customfields
        } = context.messages.in.content;

        let url = "/projects.json"
        if (tentative) {
            url = "/projects/tentative.json"
        }

        // Teamwork API expects people as a comma-separated string of IDs
        let peopleIds = "";
        if (people != null && people !== "") {
            peopleIds = Array.isArray(people) ? people.join(",") : String(people);
        }

        let body = {
            project: {
                description: "",
                companyId: companyId,
                name: name,
                tagIds: "",
                "grant-access-to": "0",
                private: false,
                "category-id": 0,
                people: peopleIds,
                projectOwnerId: 0,
                customFields: [],
                isBillable: true,
                projectType: "normal",
            },
        }

        // Add custom fields if they're set
        if (customfields?.AND?.length > 0) {
            let sanitizedCustomFields = [];
            for (let cf of customfields.AND) {
                let id = cf.name.split('-')[0];
                let type = cf.name.split('-')[1];

                if (type === 'number') {
                    if (!Number.isInteger(+cf.value)) {
                        throw new Error(`Invalid value "${cf.value}" for number custom field`);
                    }
                    cf.value = parseInt(cf.value, 10);
                }
                sanitizedCustomFields.push({
                    "customFieldId": Number(id),
                    "value": cf.value
                })
            }

            body.project.customFields = sanitizedCustomFields
        }

        let resp = await lib.callAPI(context, "POST", url, body);

        context.sendJson(resp, "project");
    },
};

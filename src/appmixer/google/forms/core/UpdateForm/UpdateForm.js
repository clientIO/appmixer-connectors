
'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const input = context.messages.in.content;
        const formId = input.formId;
        
        if (!formId) {
            throw new Error('Form ID is required');
        }

        // Extract update fields from the input
        const documentTitle = input['updateBody|documentTitle'];
        const description = input['updateBody|description'];
        const itemId = input['updateBody|items|itemId'];
        const itemTitle = input['updateBody|items|title'];
        const questionText = input['updateBody|items|questionItem|question|questionText'];
        const questionRequired = input['updateBody|items|questionItem|question|required'];
        const questionChoices = input['updateBody|items|questionItem|question|questionItemOptions|choices'];
        const collectEmail = input['updateBody|settings|collectEmail'];
        const shuffleQuestions = input['updateBody|settings|shuffleQuestions'];

        // Build update requests based on what needs to be updated
        const requests = [];

        // Update form info
        if (documentTitle || description) {
            const updateInfoRequest = {
                updateFormInfo: {
                    info: {},
                    updateMask: []
                }
            };

            if (documentTitle) {
                updateInfoRequest.updateFormInfo.info.title = documentTitle;
                updateInfoRequest.updateFormInfo.info.documentTitle = documentTitle;
                updateInfoRequest.updateFormInfo.updateMask.push('title', 'documentTitle');
            }

            if (description) {
                updateInfoRequest.updateFormInfo.info.description = description;
                updateInfoRequest.updateFormInfo.updateMask.push('description');
            }

            requests.push(updateInfoRequest);
        }

        // Update settings
        if (collectEmail !== undefined || shuffleQuestions !== undefined) {
            const updateSettingsRequest = {
                updateSettings: {
                    settings: {
                        quizSettings: {}
                    },
                    updateMask: []
                }
            };

            if (collectEmail !== undefined) {
                updateSettingsRequest.updateSettings.settings.quizSettings.isQuiz = false;
                updateSettingsRequest.updateSettings.updateMask.push('quizSettings.isQuiz');
            }

            requests.push(updateSettingsRequest);
        }

        // Update or create item
        if (itemId && (itemTitle || questionText || questionRequired !== undefined || questionChoices)) {
            const updateItemRequest = {
                updateItem: {
                    item: {
                        itemId: itemId
                    },
                    location: {
                        index: 0  // Update first item by default
                    },
                    updateMask: []
                }
            };

            if (itemTitle) {
                updateItemRequest.updateItem.item.title = itemTitle;
                updateItemRequest.updateItem.updateMask.push('title');
            }

            if (questionText || questionRequired !== undefined) {
                updateItemRequest.updateItem.item.questionItem = {
                    question: {}
                };

                if (questionText) {
                    updateItemRequest.updateItem.item.questionItem.question.questionText = questionText;
                    updateItemRequest.updateItem.updateMask.push('questionItem.question.questionText');
                }

                if (questionRequired !== undefined) {
                    updateItemRequest.updateItem.item.questionItem.question.required = questionRequired;
                    updateItemRequest.updateItem.updateMask.push('questionItem.question.required');
                }
            }

            requests.push(updateItemRequest);
        } else if (!itemId && (itemTitle || questionText)) {
            // Create new item if no itemId provided
            const createItemRequest = {
                createItem: {
                    item: {
                        title: itemTitle || '',
                        questionItem: {
                            question: {
                                required: questionRequired === true,
                                textQuestion: {
                                    paragraph: false
                                }
                            }
                        }
                    },
                    location: {
                        index: 0  // Add at the beginning
                    }
                }
            };

            if (questionText) {
                createItemRequest.createItem.item.questionItem.question.questionText = questionText;
            }

            requests.push(createItemRequest);
        }

        try {
            // https://developers.google.com/forms/api/reference/rest/v1/forms/batchUpdate
            const { data } = await context.httpRequest({
                method: 'POST',
                url: `https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`,
                headers: {
                    'Authorization': `Bearer ${context.auth.apiToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    requests: requests
                }
            });

            // Get the updated form to return current state
            const { data: updatedForm } = await context.httpRequest({
                method: 'GET',
                url: `https://forms.googleapis.com/v1/forms/${formId}`,
                headers: {
                    'Authorization': `Bearer ${context.auth.apiToken}`
                }
            });

            // Transform the response
            const output = {
                formId: updatedForm.formId,
                documentTitle: updatedForm.info?.title,
                description: updatedForm.info?.description,
                items: updatedForm.items || [],
                settings: updatedForm.settings,
                writeControl: data.writeControl
            };

            return context.sendJson(output, 'out');
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`Form with ID '${formId}' not found`);
            }
            throw new Error(`Failed to update form: ${error.response?.data?.error?.message || error.message}`);
        }
    }
};

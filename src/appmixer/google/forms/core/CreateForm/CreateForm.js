'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const input = context.messages.in.content;

        // Extract values from the input with proper handling of nested properties
        const documentTitle = input.documentTitle;
        const description = input.description;
        const itemTitle = input['items|title'];
        const questionText = input['items|questionItem|question|questionText'];
        const questionRequired = input['items|questionItem|question|required'];
        const questionChoices = input['items|questionItem|question|questionItemOptions|choices'];
        const collectEmail = input['settings|collectEmail'];
        const shuffleQuestions = input['settings|shuffleQuestions'];

        // Build the form request body
        const formBody = {
            info: {
                title: documentTitle || 'Untitled Form',
                documentTitle: documentTitle || 'Untitled Form'
            }
        };

        if (description) {
            formBody.info.description = description;
        }

        // Add settings if provided
        if (collectEmail !== undefined || shuffleQuestions !== undefined) {
            formBody.settings = {
                quizSettings: {}
            };

            if (collectEmail !== undefined) {
                formBody.settings.quizSettings.isQuiz = false;
            }
        }

        // Add items if provided
        if (questionText) {
            formBody.items = [{
                title: itemTitle || '',
                questionItem: {
                    question: {
                        questionId: 'q1',
                        required: questionRequired === true,
                        textQuestion: {
                            paragraph: false
                        }
                    }
                }
            }];

            // Add question text
            if (questionText) {
                formBody.items[0].questionItem.question.questionText = questionText;
            }

            // Add choices if provided for multiple choice questions
            if (questionChoices && questionChoices.AND && Array.isArray(questionChoices.AND)) {
                // Convert to multiple choice question
                delete formBody.items[0].questionItem.question.textQuestion;
                formBody.items[0].questionItem.question.choiceQuestion = {
                    type: 'RADIO',
                    options: questionChoices.AND.map(choice => ({
                        value: typeof choice === 'string' ? choice : (choice['items|questionItem|question|questionItemOptions|choices_item'] || '')
                    }))
                };
            }
        }

        try {
            // https://developers.google.com/forms/api/reference/rest/v1/forms/create
            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://forms.googleapis.com/v1/forms',
                headers: {
                    'Authorization': `Bearer ${context.auth.apiToken}`,
                    'Content-Type': 'application/json'
                },
                data: formBody
            });

            // Transform the response to match the expected output schema
            const output = {
                formId: data.formId,
                documentTitle: data.info?.title,
                description: data.info?.description,
                items: data.items?.map(item => ({
                    itemId: item.itemId,
                    title: item.title,
                    questionItem: item.questionItem
                })) || [],
                settings: data.settings
            };

            return context.sendJson(output, 'out');
        } catch (error) {
            throw new Error(`Failed to create form: ${error.response?.data?.error?.message || error.message}`);
        }
    }
};

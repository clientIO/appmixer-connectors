'use strict';

const lib = require('../../lib.generated');
const schema = {
    'responseId': {
        'type': 'string',
        'title': 'Response Id'
    },
    'createTime': {
        'type': 'string',
        'title': 'Create Time'
    },
    'lastSubmittedTime': {
        'type': 'string',
        'title': 'Last Submitted Time'
    },
    'answers': {
        'type': 'array',
        'items': {
            'type': 'object',
            'properties': {
                'questionId': {
                    'type': 'string',
                    'title': 'Answers.Question Id'
                },
                'grade': {
                    'type': 'object',
                    'properties': {
                        'answers': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'score': {
                                        'type': 'number',
                                        'title': 'Answers.Grade.Answers.Score'
                                    },
                                    'correct': {
                                        'type': 'boolean',
                                        'title': 'Answers.Grade.Answers.Correct'
                                    },
                                    'feedback': {
                                        'type': 'object',
                                        'properties': {},
                                        'title': 'Answers.Grade.Answers.Feedback'
                                    }
                                }
                            },
                            'title': 'Answers.Grade.Answers'
                        }
                    },
                    'title': 'Answers.Grade'
                },
                'fileUploadAnswers': {
                    'type': 'object',
                    'properties': {
                        'answers': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'fileId': {
                                        'type': 'string',
                                        'title': 'Answers.File Upload Answers.Answers.File Id'
                                    },
                                    'fileName': {
                                        'type': 'string',
                                        'title': 'Answers.File Upload Answers.Answers.File Name'
                                    },
                                    'mimeType': {
                                        'type': 'string',
                                        'title': 'Answers.File Upload Answers.Answers.Mime Type'
                                    }
                                }
                            },
                            'title': 'Answers.File Upload Answers.Answers'
                        }
                    },
                    'title': 'Answers.File Upload Answers'
                },
                'textAnswers': {
                    'type': 'object',
                    'properties': {
                        'answers': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'value': {
                                        'type': 'string',
                                        'title': 'Answers.Text Answers.Answers.Value'
                                    }
                                }
                            },
                            'title': 'Answers.Text Answers.Answers'
                        }
                    },
                    'title': 'Answers.Text Answers'
                }
            }
        },
        'title': 'Answers'
    },
    'respondentEmail': {
        'type': 'string',
        'format': 'email',
        'title': 'Respondent Email'
    },
    'totalScore': {
        'type': 'number',
        'title': 'Total Score'
    }
};

module.exports = {

    async receive(context) {
        const { formId, filter, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Responses', value: 'responses' });
        }

        try {
            // Build URL with optional filter parameter
            const url = new URL(`https://forms.googleapis.com/v1/forms/${formId}/responses`);

            // Add filter parameter if provided
            if (filter && filter.trim()) {
                url.searchParams.append('filter', filter.trim());
            }

            const { data } = await context.httpRequest({
                method: 'GET',
                url: url.toString(),
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                }
            });

            let records = data.responses || [];
            if (records.length === 0) {
                return context.sendJson({}, 'notFound');
            }

            records = records.map(response => {
                const { answers, ...rest } = response;
                return {
                    ...rest,
                    answers: Object.values(answers || {}).reduce((acc, value) => {
                        acc.push(value);
                        return acc;
                    }, [])
                };
            });
            return lib.sendArrayOutput({ context, records, outputType });

        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new context.CancelError('Form not found or no responses available');
            }
            throw error;
        }
    }
};

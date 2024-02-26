'use strict';
const Promise = require('bluebird');
const commons = require('../../dropbox-commons');

/**
 * Function to check job status.
 * @param {Context} context
 * @param {Object} params
 * @param {function} callback
 */
function checkJobStatus(context, params, callback) {

    commons
        .dropboxRequest(
            context,
            context.auth.accessToken,
            'files',
            'save_url/check_job_status',
            JSON.stringify(params)
        )
        .then(({ data }) => {
            if (data['.tag'] === 'in_progress') {
                setTimeout(() => {
                    checkJobStatus(context, params, callback);
                }, 3000);
            } else {
                callback(null, data);
            }
        })
        .catch((err) => {
            callback(err);
        });
}

/**
 * Component for create text file with url.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let params = {
            path: context.messages.url.content.path,
            url: context.messages.url.content.url
        };

        return commons
            .dropboxRequest(
                context,
                context.auth.accessToken,
                'files',
                'save_url',
                JSON.stringify(params)
            )
            .then(({ data }) => {
                params = {
                    async_job_id: data['async_job_id']
                };

                return new Promise((resolve, reject) => {
                    checkJobStatus(context, params, (err, result) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(result);
                    });
                });
            })
            .then(({ data }) => {
                return context.sendJson(data, 'urlFile');
            });
    }
};

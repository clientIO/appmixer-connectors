'use strict';
const EvernoteAPI = require('evernote');
const HttpError = require('appmixer-lib').util.HttpError;

// https://dev.evernote.com/doc/reference/Errors.html
const ErrorCodeEnum = {
    1: { code: 'UNKNOWN', message: 'No information available about the error' },
    2: { code: 'BAD_DATA_FORMAT', message: 'The format of the request data was incorrect' },
    3: { code: 'PERMISSION_DENIED', message: 'Not permitted to perform action' },
    4: { code: 'INTERNAL_ERROR', message: 'Unexpected problem with the service' },
    5: { code: 'DATA_REQUIRED', message: 'A required parameter/field was absent' },
    6: { code: 'LIMIT_REACHED', message: 'Operation denied due to data model limit' },
    7: { code: 'QUOTA_REACHED', message: 'Operation denied due to user storage limit' },
    8: { code: 'INVALID_AUTH', message: 'Username and/or password incorrect' },
    9: { code: 'AUTH_EXPIRED', message: 'Authentication token expired' },
    10: { code: 'DATA_CONFLICT', message: 'Change denied due to data model conflict' },
    11: { code: 'ENML_VALIDATION', message: 'Content of submitted note was malformed' },
    12: { code: 'SHARD_UNAVAILABLE', message: 'Service shard with account data is temporarily down' },
    13: { code: 'LEN_TOO_SHORT', message: 'Operation denied due to data model limit, where something such as a string length was too short' },
    14: { code: 'LEN_TOO_LONG', message: 'Operation denied due to data model limit, where something such as a string length was too long' },
    15: { code: 'TOO_FEW', message: 'Operation denied due to data model limit, where there were too few of something.' },
    16: { code: 'TOO_MANY', message: 'Operation denied due to data model limit, where there were too many of something.' },
    17: { code: 'UNSUPPORTED_OPERATION', message: 'Operation denied because it is currently unsupported.' },
    18: { code: 'TAKEN_DOWN', message: 'Operation denied because access to the corresponding object is prohibited in response to a take-down notice.' },
    19: { code: 'RATE_LIMIT_REACHED', message: 'Operation denied because the calling application has reached its hourly API call limit for this user.' },
    20: { code: 'BUSINESS_SECURITY_LOGIN_REQUIRED', message: 'Access to a business account has been denied because the user must complete additional steps in order to comply with business security requirements.' },
    21: { code: 'DEVICE_LIMIT_REACHED', message: 'Operation denied because the user has exceeded their maximum allowed number of devices.' }
};

function EvernoteError(message, data, code) {

    this.message = message;
    this.data = data;
    this.code = code;
    this.name = 'EvernoteError';
    Error.captureStackTrace(this, EvernoteError);
}
EvernoteError.prototype = Object.create(Error.prototype);
EvernoteError.prototype.constructor = EvernoteError;

module.exports = {

    /**
     * Make error human readable (append message for given error code)
     * @param  {Object} err
     * @return {Error}
     */
    verboseError(err) {

        if (err.errorCode) {
            let { code, message } = ErrorCodeEnum[err.errorCode];
            return new EvernoteError(message, err, code);
        }
        if (err.statusCode) {
            err.message = err.message || 'Error from Evernote API';
            return HttpError.returnHttpError(err);
        }
        if (!(err instanceof Error)) {
            return new Error(JSON.stringify(err));
        }
        return err;
    },

    /**
     * Get new EvernoteAPI
     * @param {string} token
     * @returns {*}
     */
    getEvernoteAPI(token) {

        return new EvernoteAPI.Client({
            'token': token,
            'sandbox':  process.env['EVERNOTE_SANDBOX'] || false
        });
    },

    /**
     * Evernote has uses unix timestamp in ms, but the rest of AppMixer works on ISO,
     * use this function to reformat datetimes.
     * @param {string} timestamp
     * @return {string} datetime in ISO
     */
    formatDate(timestamp) {

        if (!timestamp) {
            return timestamp;
        }
        return new Date(timestamp).toISOString();
    },

    /**
     * Go through certain record fields and apply format function.
     * @param {Object} record - salesforce record - contact, ...
     * @param {Array} fields - array with field names to be formatted
     * @param {function} formatFunc
     * @return {Object} record
     */
    formatFields(record, fields, formatFunc) {

        fields.forEach(field => {
            record[field] = formatFunc(record[field]);
        });
        return record;
    }
};

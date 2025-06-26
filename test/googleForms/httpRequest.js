const axios = require('axios');

// Simple httpRequest wrapper for tests
module.exports = async function httpRequest(config) {
    try {
        const response = await axios(config);
        return {
            data: response.data,
            status: response.status,
            headers: response.headers
        };
    } catch (error) {
        if (error.response) {
            // Server responded with error status
            const newError = new Error(error.message);
            newError.response = {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            };
            throw newError;
        }
        throw error;
    }
};

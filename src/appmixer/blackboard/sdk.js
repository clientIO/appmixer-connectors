'use strict';
const FormData = require('form-data');

module.exports = class Blackboard {

    constructor(clientId, clientSecret, serverUrl, redirectUri, axiosClient) {

        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;

        this.server = serverUrl;
        this.axiosClient = axiosClient;
    }

    getAuthUrl(state) {

        return `${this.server}/learn/api/public/v1/oauth2/authorizationcode?` +
            `redirect_uri=${this.redirectUri}&response_type=code&client_id=${this.clientId}&scope=read&state=${state}`;
    }

    async requestAccessToken(code) {

        const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: this.clientId,
            redirect_uri: this.redirectUri
        });
        const { data } = await this.axiosClient.post(`${this.server}/learn/api/public/v1/oauth2/token`, params.toString(), {
            headers: {
                Authorization: `Basic ${basicAuth}`
            }
        });
        return data;
    }

    async refreshToken(refreshToken) {

        const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.clientId,
            redirect_uri: this.redirectUri
        });
        const { data } = await this.axiosClient.post(`${this.server}/learn/api/public/v1/oauth2/token`, params.toString(), {
            headers: {
                Authorization: `Basic ${basicAuth}`
            }
        });
        return data;
    }

    setAccessToken(accessToken) {

        this.accessToken = accessToken;
    }

    async callApi(method, path, data) {

        const { data: axiosData } = await this.axiosClient.request({
            url: `${this.server}/learn/api/public${path}`,
            method,
            data,
            headers: {
                Authorization: `Bearer ${this.accessToken}`
            }
        });
        return axiosData;
    }

    async uploadFile(fileStream, fileInfo) {

        const data = new FormData();

        data.append('file', fileStream, {
            filename: fileInfo.filename,
            contentType: fileInfo.contentType,
            knownLength: fileInfo.length
        });

        const config = {
            method: 'post',
            url: `${this.server}/learn/api/public/v1/uploads`,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                ...data.getHeaders()
            },
            data : data
        };

        const { data: axiosData } = await this.axiosClient(config);
        return axiosData;
    }
};

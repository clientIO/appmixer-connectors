'use strict';
const path = require('path');
const Ftp = require('basic-ftp');
const Sftp = require('ssh2-sftp-client');
const lib = require('./lib');

class FtpClient {

    static async getClientAndConnect(secure, config) {

        const ftp = new FtpClient(secure, config);
        await ftp.connect();
        return ftp;
    }

    constructor(secure, config) {

        this.config = config;

        if (FtpClient.isFtp(secure)) {
            if (!!config.privateKey) {
                throw new Error('Private key can be used only for SFTP');
            }
            this.isFtp = true;
            this.client = new Ftp.Client();
        } else {
            this.isFtp = false;
            this.client = new Sftp();
        }
    }

    async connect() {

        if (this.isFtp) {
            this.config.user = this.config.username;
            await this.client.access(this.config);
        } else {
            delete this.config.secure;
            await this.client.connect(this.config);
        }
    }

    async close() {

        return this.isFtp ? this.client.close() : this.client.end();
    }

    async retrieveOne(filePath) {
        if (this.isFtp) {
            return await this.client.list(filePath);
        } else {
            const fileName = path.basename(filePath);

            const folderPath = filePath.replace(fileName, '');
            return await this.client.list(folderPath, (f) => f.name === fileName);
        }
    }

    async list(path) {

        return await this.client.list(path);
    }

    async createDir(path) {

        return this.isFtp ? this.client.ensureDir(path) : this.client.mkdir(path, true);
    }

    async downloadFile(path, writableStream) {

        return this.isFtp ? this.client.downloadTo(writableStream, path) : this.client.get(path, writableStream);
    }

    async remove(path) {

        return this.isFtp ? await this.client.remove(path) : await this.client.delete(path, true);
    }

    async removeDir(path) {

        return this.isFtp ? this.client.removeDir(path) : this.client.rmdir(path, true);
    }

    async rename(path, newPath) {

        return this.client.rename(path, newPath);
    }

    async put(fileReadStream, path) {

        return this.isFtp ? this.client.uploadFrom(fileReadStream, path) : this.client.put(fileReadStream, path);
    }

    /**
     * @param {string} secure
     * @returns {boolean}
     * @protected
     */
    static isFtp(secure) {

        return secure !== 'sftp';
    }

    static createConfig(authContext) {
        let config = {
            host: authContext.host,
            username: authContext.username,
            secure: lib.getAccessSecureType(authContext.secure),
            privateKey: authContext.privatekey,
            password: authContext.password
        };

        if (authContext.port) {
            config.port = authContext.port;
        }

        return config;
    }
}

module.exports = FtpClient;

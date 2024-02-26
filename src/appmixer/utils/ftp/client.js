'use strict';
const Ftp = require('basic-ftp');
const Sftp = require('ssh2-sftp-client');

class FtpClient {

    static async getClientAndConnect(secure, config) {

        const ftp = new FtpClient(secure, config);
        await ftp.connect();
        return ftp;
    }

    constructor(secure, config) {

        this.config = config;
        this.isFtp = FtpClient.isFtp(secure);
        if (this.isFtp) {
            this.client = new Ftp.Client();
        } else {
            this.client = new Sftp();
        }
    }

    async connect() {

        if (this.isFtp) {
            await this.client.access(this.config);
        } else {
            delete this.config.secure;
            await this.client.connect(this.config);
        }
    }

    async close() {

        return this.isFtp ? this.client.close() : this.client.end();
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

        return ['yes', 'implicit', ''].includes(secure);
    }
}

module.exports = FtpClient;

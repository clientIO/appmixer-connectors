const { Transform } = require('stream');

module.exports = {

    table: {
        jsonPath: '*',
        transform: () => {
            return new Transform({
                writableObjectMode: true,
                readableObjectMode: false,
                transform(chunk, encoding, callback) {
                    try {
                        if (!this.headerWritten) {
                            const meta = '<meta charset="utf-8"/>';
                            const title = '<title>SheetJS Table Export</title>';
                            this.push(`<html><head>${meta}${title}</head><body><table>`);
                            this.push('<tr>');
                            Object.keys(chunk).forEach(key => {
                                this.push(`<th>${key}</th>`);
                            });
                            this.push('</tr>');
                            this.headerWritten = true;
                        }

                        this.push('<tr>');
                        Object.values(chunk).forEach(value => {
                            this.push(`<td>${value}</td>`);
                        });
                        this.push('</tr>');

                        callback();
                    } catch (err) {
                        callback(new Error('Error transforming JSON to HTML: ' + err.message));
                    }
                },
                final(callback) {
                    if (!this.headerWritten) {
                        this.push('<html><body><table>');
                    };
                    this.push('</table></body></html>');
                    callback();
                }
            });
        }
    }
};

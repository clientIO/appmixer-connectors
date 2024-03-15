'use strict';
const Translate = require('@google-cloud/translate');

module.exports = {

    receive(context) {

        const translate = new Translate({
            credentials: {
                'client_email': context.auth.clientEmail
                    || 'starting-account-6ejx98ishf7o@appmixer-1470400881740.iam.gserviceaccount.com',
                'private_key': context.auth.privateKey
                    // eslint-disable-next-line max-len
                    || '-----BEGIN PRIVATE KEY-----\nMIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQCe4XZgSvC57ko3\ntMVeiTI57HhlU64cPACFJh9ezFzxC15ntV2C8cqF7+CIdHDP2qRj+YAZUWmoxwXH\nrHvr1E3TjhCixL5IwoGJPMO9X6sNpxWItlRR0wN1+Y2Bc5SZfL4pbBOuYe+VfeGk\n2g3826LGWa5NlnIESBi35J0tIWJ76FGHUjN2LIjotJGW29ypp/lrSOPkxMul/2TN\nM8Mw9lZl9wfdsJ5aS0EwtGMc0W4/7xZJ/LRGkf/4Ws3L+0AVrL+jCK4mp1HUkgJs\nfvP9NaA0y3RpY4apcw/6+Gs6X5FtduUwvQz8eqRVohO8bLLV2Z23K3LzvHK01tpf\nVuDfFYhRAgMBAAECgf9Tlutg3gyoxeXmSQVOJ4B1WSQ+qzf/QtJDOztl9L8xUnno\ntlLsgam7rejD4f84XCABOVNb/qlIUu2HkAfim2AW3beC61/xh+P/ACk7iQnFtRJv\nSv4xzoMTnqgEY3rbBfZGdMYmCQCz9faxdMfHMQcCtEwwJeb2ubfHiE/pXpch+NQu\nZM9LgW7euEz9gWTmhNm3qe0d0gQ/TdjW1yCGwHULsjkulO3xo3cFrNaRAich9S8E\n8MmIe5u15qCPUjvpoCKI2Uo+UZdBBV864CdIJS4FMkQ1BQZnnB31HQYJ4oFMfe0n\nVhKWmXwYwqAcIvkD5jWFZ2N7zqfeInCR8yv/G6ECgYEAzPHTP3iAmd2Pm/Ga0i0I\nZ35hXtSMo+iXSX3Sqr45dYcHOW3gRmKVjgxkhTPS1yxp+ib5BzNzxNCN0sKz/VWD\nouKBfAHgTMgCAlCfXXz+aTWeKaOtczw6CGITBmbEpzlNBajCm6OZ/tsjwSngdW/d\ntmj8HleCmCGApVevPzXc/7ECgYEAxnXy6adNp0qG4JNycPJk4l/ekyRrsj5INaW+\nDl3Sphi8NrtDAVGB12y/UrM8LvuND9NslQJy5lNhbK1uJEBePdQo+DwXhTU3BbC5\n6hHh/n4qQJ7qf29Xoxa8U8mujTImW0ZhXPB8uJZrXleadPFVpDg7JNTf5lwj2SuA\nrrYc2qECgYEAqFQnMgaDed0kyuzSQLaEJJ0E1KK3MRkkyVPy6BJ9ly5knKLGhokK\nVTWQimdaUSlFkhTYjTWRbKHvGqCYvQazq+FmgLf5xpawL76QZnT3cOp9Ea5CFFfv\nQltrTOKzurWxsWg/Dx58qXrMDyeaGFrdO6lXCoTN2q4Jv8QZSE2xSsECgYBwqwmK\n6LZHISJNYKf5w0LO2YpskqKpgH5SJpQtZ8ptDWHc2JcDqphCCrTbaHHkYl8E+wyL\n0+YTKIcIwbTj078s7sOLmeHod/uSuW/ymNBqQIoQQafzTOy94+xqzPbRpgTskJo5\nvzWvPYYa+zTu6wupvVqmYEv0ZZ7cbbwSc8URwQKBgGRDuSKC4vTOkEvobp0NcpBN\nNv1piv0fMNRwPBN1MqPAaOzpRUdbHT5y+jlEQm/QHFUsRIEwLB9UGGemTdU2uC2q\nRWBb5/yUcexwcAx6lcSdypzbmOgcQvyCduFKtoS/6/crP2DdC3qnIPcG79RWMEyL\nTE93+oexYlv2v9EYniaj\n-----END PRIVATE KEY-----\n'
            },
            projectId: context.auth.projectId || 'appmixer-1470400881740'
        });

        return translate
            .getLanguages('en')
            .then(results => {
                const result = results[0];
                return context.sendJson(result, 'languages');
            });
    }
};

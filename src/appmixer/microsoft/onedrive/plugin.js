const path = require('path');

module.exports = function(context) {

    context.log('info', 'Initializing Microsoft OneDrive plugin.');

    context.http.router.register({
        method: 'GET',
        path: '/picker',
        options: {
            handler: (request, h) => {
                return h.file(
                    path.join(__dirname, 'onedrive-picker-callback.html'),
                    {
                        confine: false
                    }
                );
            },
            auth: false
        }
    });

    context.log('info', 'Microsoft OneDrive API added.');
};

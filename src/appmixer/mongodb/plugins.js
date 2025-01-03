const { syncMongoConnections } = require('./jobs');

module.exports = async function() {
    setInterval(async () => {
        try {
            await syncMongoConnections();
        } catch (err) {
            console.error('MongoDB connection sync job failed:', err);
        }
    }, 60 * 1000);  // Run every 1 minute
};

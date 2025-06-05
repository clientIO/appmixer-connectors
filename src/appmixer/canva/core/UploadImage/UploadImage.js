'use strict';

module.exports = {
    async receive(context) {
        const { imageName, image } = context.messages.in.content;
        const fileStream = await context.getFileReadStream(image);
        const fileStats = await context.getFileInfo(image);
        const imageNameBase64 = Buffer.from(imageName).toString('base64');

        // Upload image to Canva
        let response = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/rest/v1/asset-uploads',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileStats.length,
                'Asset-Upload-Metadata': JSON.stringify({ name_base64: imageNameBase64 })
            },
            data: fileStream
        });

        let job = response.data.job;

        // Handle initial failure
        if (job.status === 'failed') {
            throw new context.CancelError(`Image upload failed: ${job.error.message}`);
        }

        // Poll until job is complete or failed
        while (job.status === 'in_progress') {
            context.log({ step: 'Upload is In Progress', job: job });
            await new Promise(res => setTimeout(res, 5000));
            const statusRes = await context.httpRequest({
                method: 'GET',
                url: `https://api.canva.com/rest/v1/asset-uploads/${job.id}`,
                headers: { 'Authorization': `Bearer ${context.auth.accessToken}` }
            });
            job = statusRes.data.job;

            // Check for failure during polling
            if (job.status === 'failed') {
                throw new context.CancelError(`Image upload failed during processing: ${job.error.message}`);
            }
        }

        // If success, return the asset details
        if (job.status === 'success') {
            context.log({ step: 'Upload has completed', job: job });
            let asset = job.asset;
            return context.sendJson(asset, 'out');
        }
    }
};

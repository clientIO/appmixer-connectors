(function() {

    const config = window.AppmixerChatWidget;
    if (!config) {
        console.error('AppmixerChatWidget config not found. Did you use the correct script snippet?');
        return;
    }

    // Create the open button.
    const button = document.createElement('button');
    button.textContent = config.toggleButtonClosedText || 'AI Assistant';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.padding = '10px 20px';
    button.style.backgroundColor = config.toggleButtonBackgroundColor || '#007bff';
    button.style.color = config.toggleButtonColor || 'white';
    button.style.border = config.toggleButtonBorder || 'none';
    button.style.borderRadius = config.toggleButtonBorderRadius || '5px';
    button.style.cursor = 'pointer';
    button.style.boxShadow = '2px 2px 10px rgba(0, 0, 0, 0.2)';
    button.style.fontSize = config.toggleButtonFontSize || '16px';
    button.style.zIndex = '10000';

    // Create the container panel.
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.bottom = '0px';
    panel.style.width = config.widgetWidth || '50%'; // Adjust width as needed
    panel.style.height = config.widgetHeight || '60vh'; // Adjust height as needed
    panel.style.backgroundColor = 'white';
    panel.style.boxShadow = config.panelBoxShadow || '2px 2px 10px rgba(0,0,0,0.2)';
    panel.style.transform = 'translateY(100%)'; // Initially hidden
    panel.style.transition = 'transform 0.2s ease-in-out';
    panel.style.zIndex = '9999';

    if (config.widgetPosition === 'bottom-left') {
        button.style.right = '20px';
        panel.style.right = '20px';
    } else {
        // bottom-right (default)
        button.style.left = '20px';
        panel.style.left = '20px';
    }

    // Create the iframe inside the panel.
    const iframe = document.createElement('iframe');
    iframe.src = config.chatUrl || 'https://api.qa.appmixer.com/flows/1037c66b-c2a8-489c-aa3e-efe548a38a3e/components/47a8691a-dbf9-4c4b-a0fd-dffcd66f519e';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';

    // Append iframe to panel.
    panel.appendChild(iframe);

    // Toggle function to show/hide the panel.
    button.addEventListener('click', function() {
        if (panel.style.transform === 'translateY(100%)') {
            panel.style.transform = 'translateY(-70px)';
            button.textContent = config.toggleButtonOpenedText || 'Close';
        } else {
            panel.style.transform = 'translateY(100%)';
            button.textContent = config.toggleButtonClosedText || 'AI Assistant';
        }
    });

    // Append elements to the body
    document.body.appendChild(button);
    document.body.appendChild(panel);
}());

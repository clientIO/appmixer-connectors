(function() {

    const agentIcon = `
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="24" fill="#303236"/>
    <path d="M24 18V14H20" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M28 30L32 34V20C32 19.4696 31.7893 18.9609 31.4142 18.5858C31.0391 18.2107 30.5304 18 30 18H18C17.4696 18 16.9609 18.2107 16.5858 18.5858C16.2107 18.9609 16 19.4696 16 20V28C16 28.5304 16.2107 29.0391 16.5858 29.4142C16.9609 29.7893 17.4696 30 18 30H28Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M34 24H32" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M27 23V25" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21 23V25" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 24H14" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    `;

    const closeIcon = `
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="24" fill="#303236"/>
    <path d="M14.9398 22.5095L23.0427 30.3343C23.3497 30.6308 23.7618 30.7932 24.1886 30.7857C24.6153 30.7783 25.0216 30.6016 25.318 30.2946L33.0436 22.0996" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    `;

    const config = window.AppmixerChatWidget;
    if (!config) {
        console.error('AppmixerChatWidget config not found. Did you use the correct script snippet?');
        return;
    }

    // Create the open button.
    const button = document.createElement('button');
    button.innerHTML = agentIcon;
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.backgroundColor = 'transparent';
    button.style.color = config.toggleButtonColor || 'white';
    button.style.border = config.toggleButtonBorder || 'none';
    button.style.borderRadius = config.toggleButtonBorderRadius || '5px';
    //button.style.boxShadow = '2px 2px 10px rgba(0, 0, 0, 0.2)';
    button.style.cursor = 'pointer';
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
        button.style.left = '20px';
        panel.style.left = '25px';
    } else {
        // bottom-right (default)
        button.style.right = '20px';
        panel.style.right = '25px';
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
            panel.style.transform = 'translateY(-90px)';
            button.innerHTML = closeIcon;
        } else {
            panel.style.transform = 'translateY(100%)';
            button.innerHTML = agentIcon;
        }
    });

    // Append elements to the body
    document.body.appendChild(button);
    document.body.appendChild(panel);
}());

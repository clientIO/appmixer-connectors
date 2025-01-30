# Slack connector

## Bot creation
This is a simplified guide to create a bot in Slack. This bot can be used to send messages to a channel. It cannot send direct messages to users.

### Manifest
Create a new app in Slack. Go to the `OAuth & Permissions` section and add the following scopes:
```json
{
    "display_information": {
        "name": "Appmixer Bot",
        "description": "Appmixer Slack app that allows you to send messages as bot from our SendChannelMessage and SendPrivateChannelMessage components.",
        "background_color": "#d32600"
    },
    "features": {
        "app_home": {
            "home_tab_enabled": false,
            "messages_tab_enabled": true,
            "messages_tab_read_only_enabled": true
        },
        "bot_user": {
            "display_name": "Appmixer Bot",
            "always_online": true
        }
    },
    "oauth_config": {
        "redirect_urls": [
            "https://api.SUBDOMAIN.appmixer.cloud/auth/slack/callback"
        ],
        "scopes": {
            "bot": [
				// Join public channels in a workspace
                "channels:join",
				// New Slack apps do not begin life with the ability to post in all public channels.
				// For your new Slack app to gain the ability to post in all public channels, request the chat:write.public scope.
                "chat:write.public",
                "chat:write"
            ]
        }
    },
    "settings": {
        "interactivity": {
            "is_enabled": true
        },
        "org_deploy_enabled": false,
        "socket_mode_enabled": true,
        "token_rotation_enabled": false
    }
}
```

# Woodpecker Connector

Woodpecker.co is a cold-email and sales-outreach platform. The connector authenticates
with an API key and covers campaigns, prospects, mailboxes and real-time outreach events
(webhook triggers via the connector plugin).

## Authentication — where to find your API key

Woodpecker uses API-key authentication only (no OAuth2). The key is sent in the
`x-api-key` header on every request.

1. Log in at [app.woodpecker.co](https://app.woodpecker.co).
2. In the top-right corner open **Add-ons** (Marketplace).
3. Go to **API & INTEGRATIONS → API keys**.
4. Click the green **CREATE A KEY** button and copy the generated key
   (use the copy icon; you can label each key with the integration it belongs to).
5. Paste the key into the connector's **API Key** field in Appmixer.

Notes:

- API keys are part of the **"API Key and Integrations"** add-on — included during the
  trial, a paid add-on on regular plans. If you don't see the API keys view, the add-on
  is not active on your account.
- You can create multiple keys; revoke a key in the same view to cut off an integration.
- Credentials are validated against `GET /v1/me`.

Official guide: [Generating API Key](https://woodpecker.co/help-center/en/articles/5223172-generating-api-key)

## Connecting a mailbox (required for campaigns)

Campaign components (Create Campaign, Run/Pause/Stop Campaign) and the mailbox components
need at least one **connected email account** in Woodpecker — `POST /v2/campaigns` rejects
requests without `email_account_ids` and `GET /v2/mailboxes` returns `[]` on a fresh account.

1. Log in at [app.woodpecker.co](https://app.woodpecker.co).
2. Open **Settings → Email accounts** (gear icon).
3. Click **Connect an email account** and follow the provider flow (Google/Microsoft
   OAuth or manual SMTP/IMAP).
4. The account then appears in the **List Mailboxes** component; its `id` is the
   **Email Account ID** that **Create Campaign** requires.


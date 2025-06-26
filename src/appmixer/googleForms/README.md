TEST_SERVER_URL=http://localhost:2200 appmixer test auth login src/appmixer/googleForms/auth.js -c CLIENT_ID -s CLIENT_SECRET -o "https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/forms.body.readonly,https://www.googleapis.com/auth/forms.body,https://www.googleapis.com/auth/drive.file"

appmixer test auth refresh src/appmixer/googleForms/auth.js 
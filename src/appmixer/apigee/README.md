TEST_SERVER_URL=http://localhost:2200 appmixer test auth login src/appmixer/apigee/auth.js -c 1038500334679-25o83vj5269qkj67frpgtgs0ndbaq2la.apps.googleusercontent.com -s CJrM6...  -o "https://www.googleapis.com/auth/cloud-platform"

appmixer test component src/appmixer/apigee/core/ListEnvironments -i '{"in":{"org":"new-edge-team"}}'

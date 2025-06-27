TEST_SERVER_URL=http://localhost:2200 appmixer test auth login src/appmixer/apigee/auth.js -c 1038500334679-25o83vj5269qkj67frpgtgs0ndbaq2la.apps.googleusercontent.com -s CJrM6NIQ87qfIrhbYK3tq.............. -o "https://www.googleapis.com/auth/cloud-platform"

appmixer test auth refresh src/appmixer/apigee/auth.js

appmixer test component src/appmixer/apigee/core/ListOrganizations

appmixer test component src/appmixer/apigee/core/ListEnvironments -p '{"org":"new-edge-team"}'

appmixer test component src/appmixer/apigee/core/ListKeyValueMaps -p '{"org":"new-edge-team", "env":"intermediate-dev-env"}'

appmixer test component src/appmixer/apigee/core/ListEntries -p '{"org":"new-edge-team", "env":"intermediate-dev-env"}' -i '{"in":{"mapName":"appmixer-blocked-ips"}}'

appmixer test component src/appmixer/apigee/core/ListEntries -p '{"org":"new-edge-team", "env":"intermediate-dev-env"}' -i '{"in":{"mapName":"salt-acl-policy"}}'

appmixer test component src/appmixer/apigee/core/AddEntry -p '{"org":"new-edge-team", "env":"intermediate-dev-env"}' -i '{"in":{"mapName":"appmixer-blocked-ips", "ips": "1.1.1.1", "ttl": 3600, "comment": "test"}}'

appmixer test component src/appmixer/apigee/core/AddEntry -p '{"org":"new-edge-team", "env":"intermediate-dev-env"}' -i '{"in":{"mapName":"appmixer-blocked-ips", "ips": "2001:0db8:85a3:0000:0000:8a2e:0370:7334", "ttl": 3600, "comment": "test"}}'


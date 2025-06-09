Login
TEST_SERVER_URL=http://localhost:2200 appmixer test auth login ./everart/auth.js

appmixer test component ./src/appmixer/everart/core/FindModels -i '{"in":{"search":"lades"}}'

appmixer test component ./src/appmixer/everart/core/FindModels -i '{"in":{"search":"lades", "status": "READY"}}'

appmixer test component ./src/appmixer/everart/core/GetModel -i '{"in":{"id":"281368180046323712"}}'

appmixer test component ./src/appmixer/everart/core/CreateModel -i '{"in":{"name":"test","subject":"test sube ","image_urls":{}}}'

appmixer test component ./src/appmixer/everart/core/GenerateImage -i '{"in":{"prompt":"value","id":"998732", "image":"value","type":"txt2img","outputType":"first"}}' -p '{"generateOutputPortOptions":true}'

appmixer test component ./src/appmixer/everart/core/GetGeneration -i '{"in":{"id":"282806470771351552"}}'

appmixer test component ./src/appmixer/everart/core/UpdateModel -i '{"in":{"id":"281368180046323712","name":"value"}}'
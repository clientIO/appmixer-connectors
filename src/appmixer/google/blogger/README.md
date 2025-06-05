test@client.io

TEST_SERVER_URL=http://localhost:2200 appmixer test auth login src/appmixer/google/auth.js -c 1038500334679-25o83vj5269qkj67frpgtgs0ndbaq2la.apps.googleusercontent.com -s CJrM6NIQ87qfIrhbYK3tq7Eh -o "https://www.googleapis.com/auth/blogger"

appmixer test component ./src/appmixer/google/blogger/FindBlogs -i '{"in":{"userId":"self","role":"ADMIN","outputType":"object"}}'

appmixer test component ./src/appmixer/google/blogger/CreatePost -i '{"in":{"blogId":"76667455128537580","title":"Test 1","content":"test content","isDraft":false}}'

appmixer test component ./src/appmixer/google/blogger/UpdatePost -i '{"in":{"blogId":"76667455128537580", "postId": "3680377192345066680", "title":"Test 1 updated ","content":"test content updated"}}'

appmixer test component ./src/appmixer/google/blogger/RevertPost -i '{"in":{"blogId":"76667455128537580", "postId": "3680377192345066680"}}'

appmixer test component ./src/appmixer/google/blogger/PublishPost -i '{"in":{"blogId":"76667455128537580", "postId": "3680377192345066680"}}'

appmixer test component ./src/appmixer/google/blogger/DeletePost -i '{"in":{"blogId":"76667455128537580", "postId": "6903247162720231197"}}'

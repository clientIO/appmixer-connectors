Send App Events
-----------------

Using REST API:

```
curl -XPOST -H 'Content-Type: application/json' -H "Authorization: Bearer ACCESS_TOKEN" -d '{ "foo": 5 }' "https://{APPMIXER_API_URL}/plugins/appmixer/utils/appevents/events/my-test"
```

Using Appmixer SDK:

```
appmixer.api.sendAppEvent('my-test', { foo: 5 });
```


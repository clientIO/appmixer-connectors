# RingRing

## Generate module

```sh
appmixer init openapi ./ringring/openapi.yml ./ringring/
```
## Authentication
Currently authentication for SMS API is done directly in the component and no account is being connected in Appmixer.

## Manual Updates

Apply the following manual updates since those are not covered by the OpenAPI generator.

### service.json

```json
"label": "RingRing",
```

### MessageAPiSmsRequest_Post/component.json

Make sure these are the values for the `timeScheduled` and `timeValidity` fields for inspector:
```json
"timeScheduled": {
    "type": "string",
    "pattern": "^(19|20)\\d\\d/(0[1-9]|1[012])/(0[1-9]|[12][0-9]|3[01])\\s([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$",
    "description": "The datetime (yyyy/MM/dd hh:mm:ss) at which you wish to send the SMS. If this falls outside of the Timewindow configuration, the request will be refused.",
    "path": "timeScheduled"
},
"timeValidity": {
    "type": "string",
    "pattern": "^(19|20)\\d\\d/(0[1-9]|1[012])/(0[1-9]|[12][0-9]|3[01])\\s([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$",
    "description": "Expiration datetime (yyyy/MM/dd hh:mm:ss) of message",
    "path": "timeValidity"
},
```

Make sure these are the values for the `timeScheduled` and `timeValidity` fields for schema:
```json
"timeScheduled": {
    "type": "date-time",
    "config": {
        "format": "YYYY/MM/DD HH:mm:ss"
    },
    "index": 7,
    "label": "Time Scheduled",
    "tooltip": "<p>The datetime (yyyy/MM/dd hh:mm:ss) at which you wish to send the SMS. If this falls outside of the Timewindow configuration, the request will be refused.</p>"
},
"timeValidity": {
    "type": "date-time",
    "config": {
        "format": "YYYY/MM/DD HH:mm:ss"
    },
    "index": 8,
    "label": "Time Validity",
    "tooltip": "<p>Expiration datetime (yyyy/MM/dd hh:mm:ss) of message</p>"
},
```

# Latchshot connector

This connector renders public web pages through the fixed `https://latchshot.fly.dev` API and saves direct PNG, JPEG, or PDF response bytes as an Appmixer file.

Create a recurring Free API key at <https://latchshot.fly.dev/?intent=appmixer#trial>. The Free plan renews to 100 successful renders at the start of each UTC calendar month and requires no card. Keep the API key only in Appmixer's connector authentication field.

## Boundary

- Public HTTP or HTTPS targets on ports 80 and 443 only.
- No private pages, cookies, custom target headers, sessions, scripts, selectors, proxies, clicks, forms, CAPTCHA work, or anti-bot bypass.
- Best-effort known-host ad, tracker, and chat blocking plus common cookie-banner and newsletter/signup/discount-popup hiding does not click, submit, or set state.
- The connector validates the exact artifact media type, enforces a 15 MB limit, and stores the response in Appmixer through `saveFileStream`.
- The target URL is sent to Latchshot, and the target page can observe Latchshot's rendering network. Latchshot keeps the artifact in memory for the request and does not provide a permanent artifact URL. Appmixer retention and access controls apply after the file is saved.

The connector contains no checkout or payment action. `Get Usage` returns owner-managed continuation links, but opening a link starts neither payment nor implementation work. Latchshot is an independent service and is not affiliated with or endorsed by Appmixer.

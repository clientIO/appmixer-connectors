# PrestaShop Connector

Integration with the [PrestaShop Webservice API](https://devdocs.prestashop-project.org/8/webservice/).

## Authentication

API key auth with two fields:

- **Shop URL** — base URL of the store (without `/api`), e.g. `https://www.myshop.com`.
- **Webservice Key** — generated in the back office: *Advanced Parameters → Webservice → Add new webservice key → Generate!*. The Webservice itself must be enabled on the same page.

The key needs **GET** permission on: `carts`, `contacts`, `customers`, `customer_messages`, `customer_threads`, `groups`, `orders`, `order_details`, `order_histories`, `order_states`, `products`, `stock_availables` — and **POST** on `customer_messages` and `customer_threads` (AttachMessage, CreateNote). The E2E find-returns flow additionally POSTs to `order_histories`.

## PrestaShop API Gotchas

These cost real debugging time — the components already handle them, keep them in mind when extending the connector:

- **`date=1` is mandatory** on any request that sorts or filters by a date field (`sort=[date_add_DESC]` etc.). Without it the Webservice answers **500**.
- **`GET /api/?output_format=JSON` (root resource listing) returns 500 on PrestaShop 8** — a core bug in `WebserviceOutputJSON` (an apostrophe in a resource description crashes the serializer). The XML root listing works, which is why `auth.js` validates without `output_format=JSON`.
- **Merchandise returns (RMA) are NOT exposed by the Webservice API in any PrestaShop version** (1.7, 8, 9) — the `OrderReturn` class has no `webserviceParameters`. `FindReturns` therefore reconstructs the return journey from `order_histories` joined with `order_states` (a state belongs to the journey when its email `template` is `refund` or its name mentions a return/refund).
- Multilang fields come back as an array of `{ id, value }` objects — take the first value.
- An error of the form *"Resource of type X does not exists"* with a resource list means the resource is missing from `WebserviceRequest::getResources()` in the PrestaShop core — the resource registry, not the domain classes, is the authority.

## Local Test Instance (Docker)

A disposable PrestaShop 8 with demo data (19 products; customer `2` = `pub@prestashop.com` owns 5 orders — customer `1` is the GDPR anonymous account and has no data):

```bash
docker network create ps-net
docker run -d --name ps-db --network ps-net \
  -e MYSQL_ROOT_PASSWORD=admin -e MYSQL_DATABASE=prestashop \
  mysql:8.0 --default-authentication-plugin=mysql_native_password
docker run -d --name ps-shop --network ps-net -p 8080:80 \
  -e DB_SERVER=ps-db -e DB_PASSWD=admin \
  -e PS_INSTALL_AUTO=1 -e PS_DEMO_MODE=0 -e PS_ENABLE_SSL=0 \
  -e PS_DOMAIN=localhost:8080 -e PS_FOLDER_ADMIN=admin1234 \
  -e ADMIN_MAIL=demo@prestashop.com -e ADMIN_PASSWD=prestashop_demo \
  prestashop/prestashop:8-apache
```

Wait for the auto-install (`docker logs -f ps-shop`, a couple of minutes). Back office: `http://localhost:8080/admin1234`, login `demo@prestashop.com` / `prestashop_demo`.

### Enable the Webservice and create a key via SQL

The admin UI works too, but this is scriptable. Note the `PS_WEBSERVICE` configuration row does **not** exist by default — it must be INSERTed, not UPDATEd:

```bash
KEY=$(python3 -c "import secrets; print(secrets.token_hex(16).upper())")
docker exec ps-db mysql -uroot -padmin prestashop -e "
INSERT INTO ps_configuration (name, value, date_add, date_upd) VALUES
  ('PS_WEBSERVICE','1',NOW(),NOW()),
  ('PS_ORDER_RETURN','1',NOW(),NOW());
UPDATE ps_configuration SET value='3' WHERE name='PS_MAIL_METHOD'; -- disable e-mails
INSERT INTO ps_webservice_account (\`key\`, description, class_name, is_module, module_name, active)
  VALUES ('$KEY','e2e','WebserviceRequest',0,NULL,1);
SET @acc = LAST_INSERT_ID();
INSERT INTO ps_webservice_account_shop (id_webservice_account, id_shop) VALUES (@acc, 1);
INSERT INTO ps_webservice_permission (resource, method, id_webservice_account)
SELECT r.res, m.met, @acc FROM
 (SELECT 'carts' res UNION SELECT 'contacts' UNION SELECT 'customers'
  UNION SELECT 'customer_messages' UNION SELECT 'customer_threads' UNION SELECT 'groups'
  UNION SELECT 'orders' UNION SELECT 'order_histories' UNION SELECT 'order_details'
  UNION SELECT 'order_states' UNION SELECT 'products' UNION SELECT 'stock_availables'
  UNION SELECT 'messages') r,
 (SELECT 'GET' met UNION SELECT 'POST' UNION SELECT 'PUT' UNION SELECT 'DELETE' UNION SELECT 'HEAD') m;"
docker exec ps-shop sh -c 'rm -rf /var/www/html/var/cache/prod/*'   # config is cached
echo "Webservice key: $KEY"
curl -s -u "$KEY:" "http://localhost:8080/api/products?output_format=JSON&limit=1"   # smoke test
```

### Expose the shop to a cloud Appmixer instance (ngrok)

PrestaShop answers a foreign `Host` header with a 302 to its stored domain, so the domain must be rewritten to the tunnel host:

```bash
ngrok http 8080          # note the https://<id>.ngrok.app URL
docker exec ps-db mysql -uroot -padmin prestashop -e "
UPDATE ps_shop_url SET domain='<id>.ngrok.app', domain_ssl='<id>.ngrok.app';
UPDATE ps_configuration SET value='<id>.ngrok.app' WHERE name IN ('PS_SHOP_DOMAIN','PS_SHOP_DOMAIN_SSL');
UPDATE ps_configuration SET value='1' WHERE name IN ('PS_SSL_ENABLED','PS_SSL_ENABLED_EVERYWHERE');"
docker exec ps-shop sh -c 'rm -rf /var/www/html/var/cache/prod/*'
```

Connector auth is then Shop URL = `https://<id>.ngrok.app`, Webservice Key = `$KEY`.

### Seed data the E2E flows need

The customer-messages flow needs at least one customer thread (demo data has none):

```bash
docker exec ps-db mysql -uroot -padmin prestashop -e "
INSERT INTO ps_customer_thread (id_shop,id_lang,id_contact,id_customer,id_order,id_product,status,email,token,date_add,date_upd)
VALUES (1,1,1,2,1,NULL,'open','pub@prestashop.com','abcdef123456',NOW(),NOW());"
```

The find-returns flow provokes its own data (it POSTs a `Refunded` history entry to order 1 via MakeApiCall); the abandoned-cart flow creates and deletes its own cart. Nothing else to seed.

### Teardown

```bash
docker rm -f ps-shop ps-db && docker network rm ps-net && pkill -f 'ngrok http'
```

## E2E Test Flows

`artifacts/test-flows/` contains 6 flows covering all 13 components. Run them with the appmixer CLI (≥ 2.6.0):

```bash
appmixer e2e import src/appmixer/prestashop/artifacts/test-flows --account <accountId>
appmixer e2e list -c appmixer:prestashop --json
appmixer e2e run <flowId> --fix
```

Flow-design notes: the AbandonedCart trigger flow waits 1 minute before creating the cart — the polling trigger baselines the existing carts on its first tick, so the provoking cart must be created *after* that tick.

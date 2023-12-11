# KTHB Almatools api
API mot Almatools()

##

###


#### Dependencies

Node 16.13.2

##### Installation

1.  Skapa folder på server med namnet på repot: "/local/docker/almatools-api"
2.  Skapa och anpassa docker-compose.yml i foldern
```
version: '3.6'

services:
  almatools-api:
    container_name: almatools-api
    image: ghcr.io/kth-biblioteket/almatools-api:${REPO_TYPE}
    restart: always
    environment:
      - TZ=${TZ}
    env_file:
      - ./almatools-api.env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.almatools-api.rule=Host(`${DOMAIN_NAME}`) && PathPrefix(`${PATHPREFIX}`)"
      - "traefik.http.routers.almatools-api.middlewares=almatools-api-stripprefix"
      - "traefik.http.middlewares.almatools-api-stripprefix.stripprefix.prefixes=${PATHPREFIX}"
      - "traefik.http.routers.almatools-api.entrypoints=websecure"
      - "traefik.http.routers.almatools-api.tls=true"
      - "traefik.http.routers.almatools-api.tls.certresolver=myresolver"
    networks:
      - "apps-net"

networks:
  apps-net:
    external: true
```
3.  Skapa och anpassa .env(för composefilen) i foldern
```
PATHPREFIX=/almatools
DOMAIN_NAME=api-ref.lib.kth.se
API_ROUTES_PATH=/v1
REPO_TYPE=ref
TZ=Europe/Stockholm
```
4.  Skapa och anpassa almatools-api.env (för applikationen) i foldern
```
PORT=80
SECRET=xxxxxx
WEBHOOKSECRET=xxxxxx
CIPHER="[]"
API_KEY_READ=xxxxxx
API_KEY_WRITE=xxxxxx

ALMAPIENDPOINT=https://api-eu.hosted.exlibrisgroup.com/almaws/v1/
ALMAAPIKEY_prod=xxxxxx
ALMAAPIKEY_PSB=xxxxxx
ALMAAPIKEY=xxxxxx
EXLIBRISPUBLICKEY_URL=https://api-eu.hosted.exlibrisgroup.com/auth/46KTH_INST/jwks.json?env=sandbox

WOS_URL=https://ws.isiknowledge.com/cps/xrpc
WOS_USER=kthroyal
WOS_PASSWORD=xxxxxx
ELSEVIER_URL=https://api.elsevier.com/content/search/scopus
ELSEVIER_APIKEY=xxxxxx

DATABASEHOST=almatools-db
DB_DATABASE=almatools
DB_USER=almatools
DB_PASSWORD=xxxxxx
DB_ROOT_PASSWORD=xxxxxx

FTP_SERVER_LIBRIS=ftp.libris.kb.se
FTP_USER_LIBRIS=kthb_eh
FTP_PASSWORD_LIBRIS=xxxxxx
TDIG_ZIP_FILE=Tdig_full_export_test.zip

NETSSECRETKEY=test-secret-key-xxxxxx
NETSCHECKOUTKEY=test-checkout-key-xxxxxx

NETSAPIURL_live=https://api.dibspayment.eu/v1/payments/
NETSAPIURL_test=https://test.api.dibspayment.eu/v1/payments/
NETSAPIURL=https://test.api.dibspayment.eu/v1/payments/
WEBHOOKURL=https://api.lib.kth.se/almapayment/v1/webhook-checkout
WEBHOOKKEY=xxxxxx
TOCURL=http://localhost:89/toc.html
GDPRURL=http://localhost:89/gdpr.html
CHECKOUTURL=http://localhost:89/checkout
TAXRATE=0

API_ROUTES_PATH=/v1
CORS_WHITELIST="http://localhost, https://apps.lib.kth.se, https://apps-ref.lib.kth.se, https://www.kth.se"
ENVIRONMENT=development
```
5. Skapa deploy_ref.yml i github actions
6. Skapa deploy_prod.yml i github actions
7. Github Actions bygger en dockerimage i github packages
8. Starta applikationen med docker compose up -d --build i "local/docker/almatools-api"


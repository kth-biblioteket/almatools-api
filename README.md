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
    env_file:
      - ./almatools-api.env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.almatools-api.rule=Host(`${DOMAIN_NAME}`) && PathPrefix(`${PATHPREFIX}`)"
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
```
4.  Skapa och anpassa almatools-api.env (för applikationen) i foldern
```
PORT=80
SECRET=xxxxx
APIKEYREAD=xxxxxxxxxxxxxxxxxxxxxxxxx
DB_DATABASE=almatools
DB_USER=almatools
DB_PASSWORD=xxxxxxxxxxxx
DB_ROOT_PASSWORD=xxxxxxxxxxxxxxx
API_ROUTES_PATH=/v1
CORS_WHITELIST="http://localhost, https://apps.lib.kth.se, https://apps-ref.lib.kth.se, https://www.kth.se"
ENVIRONMENT=development
```
5. Skapa deploy_ref.yml i github actions
6. Skapa deploy_prod.yml i github actions
7. Github Actions bygger en dockerimage i github packages
8. Starta applikationen med docker compose up -d --build i "local/docker/almatools-api"


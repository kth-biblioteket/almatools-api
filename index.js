'use strict';

require('dotenv').config({ path: 'almatools-api.env' })

const jwt = require("jsonwebtoken");
const VerifyToken = require('./VerifyToken');
const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors')
const fs = require("fs");
const path = require('path');
const Controller = require('./Controllers');
const cookieParser = require("cookie-parser");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cookieParser());

const socketIo = require("socket.io");

app.set("view engine", "ejs");

const whitelist = process.env.CORS_WHITELIST.split(", ");
app.use(cors({ origin: whitelist }));

app.use(express.static(path.join(__dirname, "public")));

const apiRoutes = express.Router();

apiRoutes.get("/", async function (req, res, next) {
    res.json('Welcome to KTH Biblioteket almatools api')
});

apiRoutes.get("/newbooks", Controller.readNewbooks)

apiRoutes.get("/newbookspage", Controller.getNewbooksList)

apiRoutes.get("/newbookscarouselpage", Controller.getNewbooksCarousel)

/**
 * Libris Lånestatus. 
 * 
 * Länk till detta api läggs in i biblioteksdatabasen hos libris på respektive bibliotek(T, Te etc)
 */
apiRoutes.get("/librisls", Controller.getlibrisLS)

/**
 * Holdshelf nummer som skickas till låntagare och skrivs ut på plocklappar
 * 
 */
apiRoutes.get("/holdshelfno/:primaryid/:additional_id", VerifyToken, Controller.getHoldShelfNo)

/**
 * Alma Webhooks
 * 
 */
apiRoutes.get('/webhook', function (req, res, next) {
    res.json({ challenge: req.query.challenge });
});

apiRoutes.post('/webhook', Controller.webhook);

/***
 * 
 * Autocomplete funktion till sökrutan för primo på bibliotekets startsida (polopoly)
 */
apiRoutes.get('/primoautocomplete', Controller.getPrimoAutoComplete) 

/***
 * 
 * Aktivera användarkonto i Alma för de med KTH-konto
 */
apiRoutes.post("/activatepatron", VerifyToken, Controller.ActivatePatron) 

/***
 * 
 * Hämta citeringsdata från WebOfScience
 */
apiRoutes.get("/citationdata/wos", VerifyToken, Controller.getCitationDataFromWoS) 

app.use(process.env.API_ROUTES_PATH, apiRoutes);

const server = app.listen(process.env.PORT || 3002, function () {
    const port = server.address().port;
    console.log(new Date().toLocaleString());
    console.log("App now running on port", port);
});

const io = socketIo(server, { path: process.env.SOCKETIOPATH })

const sockets = {}

io.on("connection", (socket) => {
    socket.on("connectInit", (sessionId) => {
        sockets[sessionId] = socket.id
        app.set("sockets", sockets)
    })
})

app.set("io", io)


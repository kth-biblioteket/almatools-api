'use strict';

require('dotenv').config({ path: 'almatools-api.env' })

const logger = require('./logger');

const jwt = require("jsonwebtoken");
const jwkToPem = require('jwk-to-pem');
const { verifyexlibristoken, verifyToken} = require('./VerifyToken');
const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors')
const fs = require("fs");
const path = require('path');
const Controller = require('./Controllers');
const cookieParser = require("cookie-parser");
const axios = require('axios');
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

/**
 * Sök bibliografisk post i Alma via Other System Number(fält 035)
 * 
 */
apiRoutes.get("/almabib/:other_system_number", Controller.getAlmaBib)

/**
 * Sök bibliografisk post i Libris via Librisid
 * 
 */
apiRoutes.get("/librisbib/:librisid", Controller.getLibrisBib)

/**
 * Hämta uppdaterade poster från Libris
 * 
 */
apiRoutes.get("/librisupdates/:from/:until", Controller.getUpdatedLibrisBib)

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
apiRoutes.get("/holdshelfno/:primaryid/:additional_id", verifyToken, Controller.getHoldShelfNo)

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
apiRoutes.post("/activatepatron", Controller.ActivatePatron) 

/***
 * 
 * Hämta citeringsdata från WebOfScience
 */
apiRoutes.get("/citationdata/wos", Controller.getCitationDataFromWoS) 

apiRoutes.get("/citationdata/elsevier", Controller.getCitationDataFromScopus)

apiRoutes.post("/createpayment/:jwt", async function (req, res, next) {
    let decodedtoken = await verifyexlibristoken(req.params.jwt)
    if (decodedtoken!=0) {
        try {
            //Hämta fees från Alma och skapa Nets Json
            let totalamount = 0;
            let almaresponse;
            let itemreference
            let orderreference
            let almapiurl
            if(req.body.fee_id == 'all') {
                almapiurl = process.env.ALMAPIENDPOINT + 'users/' + decodedtoken.userName + '/fees?user_id_type=all_unique&status=ACTIVE&apikey=' + process.env.ALMAAPIKEY
                almaresponse = await axios.get(almapiurl)
                totalamount = almaresponse.data.total_sum
                if (totalamount > 0) {
                    itemreference = almaresponse.data.fee[0].type.desc + "_all"
                    orderreference = almaresponse.data.fee[0].id + '_all'
                }
            } else {
                
                almapiurl = process.env.ALMAPIENDPOINT + 'users/' + decodedtoken.userName + '/fees/' + req.body.fee_id + '?user_id_type=all_unique&status=ACTIVE&apikey=' + process.env.ALMAAPIKEY
                almaresponse = await axios.get(almapiurl)
                totalamount = almaresponse.data.balance
                if (totalamount > 0) {
                    itemreference = almaresponse.data.type.desc
                    orderreference = almaresponse.data.id
                }
            }

            if (totalamount > 0) {
                let taxRate = process.env.TAXRATE //ingen moms på biblioteksverksamhet
                let grossTotalAmount = totalamount * 100
                let netTotalAmount = grossTotalAmount / (1 + taxRate)
                let taxAmount = netTotalAmount * taxRate
                let unitPrice = netTotalAmount
                let amount = grossTotalAmount

                const options = {
                    "headers": {
                        "content-type": "application/*+json",
                        "Authorization": process.env.NETSSECRETKEY
                    }
                };
        
                const data = {
                    "order": {
                        "items": [{
                            "reference": itemreference,
                            "name": "Alma fee",
                            "quantity": 1,
                            "unit": "pcs",
                            "unitPrice": unitPrice,
                            "taxRate": taxRate * 10000,
                            "taxAmount": taxAmount,
                            "grossTotalAmount": grossTotalAmount,
                            "netTotalAmount": netTotalAmount
                        }
                        ],
                        "amount": amount,
                        "currency": "SEK",
                        "reference": orderreference
                    },
                    "checkout": {
                        "url": process.env.CHECKOUTURL,
                        "termsUrl": process.env.TOCURL,
                        "shipping": {
                            "countries": [
                                {
                                    "countryCode": "SWE"
                                }
                            ],
                            "merchantHandlesShippingCost": false
                        },
                        "consumerType": {
                            "supportedTypes": [ "B2C" ],
                            "default": "B2C"
                        }       
                    },
                    "notifications": {
                        "webhooks": [
                            {
                                "eventName": "payment.checkout.completed",
                                "url": process.env.WEBHOOKURL,
                                "authorization": process.env.WEBHOOKKEY
                            }
                        ]
                    }
                }
                
                const netsresponse = await axios.post(process.env.NETSAPIURL, data, options)
            
                //Spara payment_id + primary_id till DB
                Controller.createPayment(netsresponse.data.paymentId, decodedtoken.userName, req.body.fee_id)
                
                res.json(netsresponse.data.paymentId)
            } else {
                res.status(400)
                res.json("Skuld saknas")
            }

        } catch(err) {
            res.status(400)
            res.json(err.message)
        }
    } else {
        res.status(400)
        res.json("None or not valid token")
    }
});

// Anropas av NETS 
apiRoutes.post("/webhook-checkout", async function (req, res, next) {

    try {
        logger.debug(JSON.stringify(req.body))
        //Hämta payment
        const payment = await Controller.readPayment(req.body.data.paymentId)
        let almaresponse
        let almapayresponse
        //Hämta almauser
        logger.debug(JSON.stringify(process.env.ALMAPIENDPOINT + 'users/' + payment[0].primary_id + '?apikey=' + process.env.ALMAAPIKEY))
        const almauser = await axios.get(process.env.ALMAPIENDPOINT + 'users/' + payment[0].primary_id + '?apikey=' + process.env.ALMAAPIKEY)
        let illpayment = false

        let illitems = []

        let almapiurl
        let almapaypiurl
        let totalamount
        if(payment[0].fee_id == 'all') {
            //Hämta fees från Alma
            almapiurl = process.env.ALMAPIENDPOINT + 'users/' + payment[0].primary_id + '/fees?user_id_type=all_unique&status=ACTIVE&apikey=' + process.env.ALMAAPIKEY
            logger.debug("webhook-checkout -- hämta alla")
            logger.debug(JSON.stringify(almapiurl))
            almaresponse = await axios.get(almapiurl)
            totalamount = almaresponse.data.total_sum
            logger.debug("webhook-checkout -- betala alla")
            logger.debug(JSON.stringify(almaresponse.data))
            almaresponse.data.fee.forEach(fee => {
                if (fee.type.value == "DOCUMENTDELIVERYSERVICE" || fee.type.value == "LOSTITEMREPLACEMENTFEE") {
                    illpayment = true;
                    illitems.push(fee)
                }
                if (fee.type.value == "DOCUMENTDELIVERYSERVICE") {
                    fee.illmessage = `Användaren ${almauser.data.full_name}(${almauser.data.primary_id}) har betalat avgiften för artikel`;
                }
                if (fee.type.value == "LOSTITEMREPLACEMENTFEE") {
                    fee.illmessage = `Användaren ${almauser.data.full_name}(${almauser.data.primary_id}) har betalat avgiften för lost item`;
                }
            });
            //Betala alla fees i Alma
            almapaypiurl = process.env.ALMAPIENDPOINT + 'users/' + payment[0].primary_id + '/fees/all?user_id_type=all_unique&op=pay&amount=' + totalamount + '&method=ONLINE&comment=Nets%20Easy&external_transaction_id=' + req.query.paymentId + '&apikey=' + process.env.ALMAAPIKEY
            logger.debug("webhook-checkout -- before pay all fees almapi")
            logger.debug(JSON.stringify(almapaypiurl))
            almapayresponse = await axios.post(almapaypiurl)
        } else {
            //Hämta fee från Alma
            almapiurl = process.env.ALMAPIENDPOINT + 'users/' + payment[0].primary_id + '/fees/' + payment[0].fee_id + '?user_id_type=all_unique&status=ACTIVE&apikey=' + process.env.ALMAAPIKEY
            logger.debug(almapiurl)
            almaresponse = await axios.get(almapiurl)
            totalamount = almaresponse.data.balance
            //Betala fee i Alma
            almapaypiurl = process.env.ALMAPIENDPOINT + 'users/' + payment[0].primary_id + '/fees/' + payment[0].fee_id + '?user_id_type=all_unique&op=pay&amount=' + totalamount + '&method=ONLINE&comment=Nets%20Easy&external_transaction_id=' + req.query.paymentId + '&apikey=' + process.env.ALMAAPIKEY
            almapayresponse = await axios.post(almapaypiurl)
            logger.debug(almapayresponse)
            if (almapayresponse.data.type.value == "DOCUMENTDELIVERYSERVICE" || almapayresponse.data.type.value == "LOSTITEMREPLACEMENTFEE") {
                illpayment = true;
                illitems.push(almapayresponse.data)
            }
            if (almapayresponse.data.type.value == "DOCUMENTDELIVERYSERVICE") {
                almapayresponse.data.illmessage = `Användaren ${almauser.data.full_name}(${almauser.data.primary_id}) har betalat avgiften för artikel`;
            }
            if (almapayresponse.data.type.value == "LOSTITEMREPLACEMENTFEE") {
                almapayresponse.data.illmessage = `Användaren ${almauser.data.full_name}(${almauser.data.primary_id}) har betalat avgiften för lost item`;
            }
        }

        if(almapayresponse.status == 200) { 
            //Skicka ett mail till edge(ill) om typen är document delivery
            if (illpayment) {
                    const handlebarOptions = {
                        viewEngine: {
                            partialsDir: path.resolve('./templates/'),
                            defaultLayout: false,
                        },
                        viewPath: path.resolve('./templates/'),
                    };

                    const transporter = nodemailer.createTransport({
                        port: 25,
                        host: process.env.SMTP_HOST,
                        tls: {
                            rejectUnauthorized: false
                        }
                    });

                    logger.debug("webhook-checkout -- handlebarOptions")
                    logger.debug(JSON.stringify(handlebarOptions))
                    transporter.use('compile', hbs(handlebarOptions))

                    let mailOptions = {}
                    mailOptions = {
                        from: {
                            name: process.env.MAILFROM_NAME,
                            address: process.env.MAILFROM_ADDRESS
                        },
                        to: process.env.MAIL_TO,
                        subject: process.env.MAILFROM_SUBJECT,
                        template: 'edge_email_sv',
                        context:{
                            name: `${almauser.data.full_name}(${almauser.data.primary_id})`,
                            illitems: illitems
                        },
                        generateTextFromHTML: true,
                    }
                    logger.debug("webhook-checkout -- mailOptions")
                    logger.debug(JSON.stringify(mailOptions))
                    try {
                        let mailinfo = await transporter.sendMail(mailOptions);
                        logger.info("webhook-checkout -- Sendmail")
                        logger.info(JSON.stringify(mailinfo))
                    } catch (err) {
                        logger.error("webhook-checkout -- Sendmail")
                        logger.error(JSON.stringify(err))
                    }
                    
            }
            
            //Uppdatera databasen att betalning är korrekt utförd(fältet finished = 1)
            let finished = 1
            const result = await Controller.updatePayment(req.body.data.paymentId, finished)
            logger.debug(JSON.stringify(result))
            res.send()
        }
    } catch(err) {
        logger.error("webhook-checkout -- catch")
        logger.error(err)
        res.status(400).send()
    }

})

apiRoutes.post("/checkpayment/:paymentId", async function (req, res, next) {
    try {
        //Hämta payment och skicka tillbaks status om betalningen är finished (= 1)
        const payment =await Controller.readPayment(req.params.paymentId)
        let paymentdata = {
            "status": "success",
            "finished": payment[0].finished
        }
        res.json(paymentdata)  
    } catch(err) {
        logger.error("checkpayment")
        logger.error(err)
        res.json('Error')
    }    
})

app.use(process.env.API_ROUTES_PATH, apiRoutes);

const server = app.listen(process.env.PORT || 3002, function () {
    const port = server.address().port;
    console.log(new Date().toLocaleString());
    console.log("App now running on port", port);
    logger.info("App now running on port", port)
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


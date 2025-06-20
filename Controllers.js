const Model = require('./Models');
const xml2js = require('xml2js');
const axios = require('axios');
const js2xmlparser = require("js2xmlparser");
const xml2jsparser = require("xml2js");
const ftp = require('basic-ftp');
const archiver = require('archiver');
const fs = require("fs");
const path = require('path');
const crypto = require('crypto')
const jwt = require("jsonwebtoken");
const jwkToPem = require('jwk-to-pem');
const https = require('https');

const logger = require('./logger');

logger.info("Controller started")

const { verifyexlibristoken, verifyToken} = require('./VerifyToken');

//Hämta nya böcker från tabellen "newbooks"
async function readNewbooks(req, res) {
    try {
        let result = await Model.readNewbooks(req)
        res.send(result)
    } catch (err) {
        res.send("error: " + err)
    }
}

//Alma Bibliotgrafisk post via SRU
async function getAlmaBib(req, res) {
    try {
        const url = `${process.env.ALMA_SRU_ENDPOINT}?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.other_system_number=="${req.params.other_system_number}"`
        const response = await axios.get(url);
        console.log(response.data)
        res.set('Content-Type', 'application/xml');
        res.send(response.data);
    } catch (err) {
        res.send("error: " + err)
    }
}

//Libris Bibliografisk post
async function getLibrisBib(req, res) {
    try {
        let url = `${process.env.LIBRISAPIENDPOINT}/${req.params.librisid}`
        let response = await axios.get(
            url,
            {
                headers: {
                    'Accept': "application/ld+json",
                    'content-type': 'application/json;charset=utf-8'
                }
            });
        //res.set('Content-Type', 'application/xml');
        res.send(response.data);
    } catch (err) {
        res.send("error: " + err)
    }
}

async function getUpdatedLibrisBib(req, res) {
    try {
         const data_binary = await new Promise((resolve, reject) => {
            fs.readFile('./librisexport.properties', (err, data) => {
                if (err) {
                    reject('Could not read the file:', err);
                } else {
                    resolve(data);
                }
            });
        });

        const options = {
            hostname: process.env.LIBRIS_HOSTNAME,
            path: `/api/marc_export?from=${req.params.from}&until=${req.params.until}&deleted=ignore&virtualDelete=false`,
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": data_binary.length,
            },
        };

        const response = await makeHttpRequest(options, data_binary);
    
        res.set('Content-Type', 'application/xml');
        res.send(response);
    } catch (err) {
        res.send("error: " + err)
    }
}

//Libris lånestatus
async function getlibrisLS(req, res) {
    try {
        let lang = req.query.lang || 'sv'
        let sru = ''
        let mmsid = '';
        let responsexml = `<?xml version="1.0" encoding="UTF-8" ?>
					<Item_Information xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://appl.libris.kb.se/LIBRISItem.xsd">`
	
        // I Alma ligger ofta libris ONR i ISBN-fältet. Men det ligger alltid i 035. i 035 ligger också bib_id. Så sök i other_system_number
        if ((req.query.ISBN || req.query.ONR || req.query.ISSN || req.query.Bib_ID) && req.query.library) {
            if (req.query.ISBN && req.query.ISBN.trim() !== '') {
                sru = `https://eu01.alma.exlibrisgroup.com/view/sru/46KTH_INST?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.isbn="${req.query.ISBN}"&maximumRecords=10`
            } else if (req.query.ISSN && req.query.ISSN.trim() !== '') {
                sru = `https://eu01.alma.exlibrisgroup.com/view/sru/46KTH_INST?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.issn="${req.query.ISSN}"&maximumRecords=10`
            } else if (req.query.ONR && req.query.ONR.trim() !== '') {
                sru = `https://eu01.alma.exlibrisgroup.com/view/sru/46KTH_INST?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.other_system_number="${req.query.ONR}"&maximumRecords=10`
            } else if (req.query.Bib_ID && req.query.Bib_ID.trim() !== '') {
                sru = `https://eu01.alma.exlibrisgroup.com/view/sru/46KTH_INST?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.other_system_number="${req.query.Bib_ID}"&maximumRecords=10`
            }
            if(sru != '') {
                const response = await axios.get(sru)
                xmlData = response.data.trim()

                result = await xml2js.parseStringPromise(xmlData)
                const recordData = result.searchRetrieveResponse.records[0].record[0].recordData[0].record[0];
                const numberOfRecords = parseInt(result.searchRetrieveResponse.numberOfRecords[0], 10);
                if(numberOfRecords != 0) {
                    const recordData = result.searchRetrieveResponse.records[0].record[0].recordData[0].record[0];
                    const controlFields = recordData.controlfield;
                
                    for (const controlfield of controlFields) {
                        if (controlfield.$.tag === '001') {
                            mmsid = controlfield._;
                            break;
                        }
                    }
                }
                if (mmsid != '') {
                    /*Hämta holdings via Alma API*/
                    let almaresponse = await axios.get(`https://api-eu.hosted.exlibrisgroup.com/almaws/v1/bibs/${mmsid}/holdings?apikey=${process.env.ALMAAPIKEY}&lang=${lang}`);
                    let holdings = almaresponse.data
                    let status_date = "";
                    let itemno = 0;
                    if (holdings['total_record_count'] > 0) {
                        for(i = 0; i < holdings.holding.length; i++) {
                            if(holdings.holding[i].library.value == "MAIN") {
                                almaresponse = await axios.get(`${holdings.holding[i].link}/items?apikey=${process.env.ALMAAPIKEY}&lang=${lang}`);
                                let items = almaresponse.data
                                if (items['total_record_count'] > 0) {
                                    for(j = 0; j < items.item.length; j++) {
                                        itemno++;
                                        let location = items.item[j]['item_data']['location']['desc'];
                                        let locationcode = items.item[j]['item_data']['location']['value'];
                                        /*Hämta location*/
                                        almaresponse = await axios.get(`https://api-eu.hosted.exlibrisgroup.com/almaws/v1/conf/libraries/${holdings.holding[i]['library']['value']}/locations/${locationcode}?apikey=${process.env.ALMAAPIKEY}&lang=${lang}`);
                                        let almalocation = almaresponse.data
                                        
                                        let externalocation = almalocation['external_name'];
                                        let call_no = items.item[j]['holding_data']['call_number'];
                                        let barcode = items.item[j]['item_data']['barcode'];

                                        /*Är materialet tillgängligt?*/
                                        if (items.item[j]['item_data']['base_status']['desc'] == "Item in place") {
                                            status = "Available";
                                            status_date = "";
                                        } else if (items.item[j]['item_data']['base_status']['desc'] == "Item not in place") {
                                            /*Kolla om det är utlånat*/
                                            if(items.item[j]['item_data']['process_type']['value'] == "LOAN") {
                                                almaresponse = await axios.get(`${items.item[j].link}/loans?apikey=${process.env.ALMAAPIKEY}&lang=${lang}`);
                                                let loans = almaresponse.data
                                                /*Gå igenom lånen och hämta tidigaste datumet*/
                                                for(k = 0; k < loans.item_loan.length; k++) {
                                                    currstatus_date = loans.item_loan[k]['due_date'].replace("Z","")
                                                    currstatus_date = currstatus_date.replace("T","")
                                                    currstatus_date = currstatus_date.substring(0,10)
                                                    if (status_date != "") {
                                                        /*kolla om aktuellt datum är tidigare*/
                                                        if (new Date(currstatus_date) < new Date(status_date)) {
                                                            status_date = currstatus_date;
                                                        }
                                                    } else {
                                                        status_date = currstatus_date;
                                                    }
                                                    status = "On loan"
                                                }
                                            } else {
                                                if(items.item[j]['item_data']['process_type']['value'] == "MISSING") {
                                                    status = "Missing";
                                                } else {
                                                    status = "Not available";
                                                }
                                            }
                                        }
                                        /*Vilken lånepolicy är det?*/
                                        if(items.item[j]['holding_data']['temp_policy']['desc'] && items.item[j]['holding_data']['temp_policy']['desc']!= '') {
                                            loan_policy = items.item[j]['holding_data']['temp_policy']['desc'];
                                        } else {
                                            loan_policy = items.item[j]['item_data']['policy']['desc'];
                                        }
                                        /*Skapa xml för varje item(lägg till response-strängen)*/
                                        responsexml += `<Item>
                                                            <Item_No>${itemno}</Item_No>
                                                            <UniqueItemId>${barcode}</UniqueItemId>
                                                            <Status>${status}</Status>
                                                            <Location>${externalocation}</Location>
                                                            <ExtLocation>${externalocation}</ExtLocation>
                                                            <Call_No>${call_no}</Call_No>
                                                            <Loan_Policy>${loan_policy}</Loan_Policy>`
                                        if (status_date != "") {
                                            responsexml += `<Status_Date_Description>Due: </Status_Date_Description>
                                                            <Status_Date>${status_date}</Status_Date>`
                                        }
                                        responsexml += '</Item>'
                                    } 
                                }
                            }
                        }
                    }
                }
            }
        }
        /*Avsluta reponse-strängen*/
        responsexml +='</Item_Information>';
        res.set('Content-Type', 'text/xml');
        res.send(responsexml)
    } catch (err) {
        res.send("error: " + err)
    }
}

async function getHoldShelfNo(req, res) {
    try {
        let currentnumber;
        let holdshelfnumber;
        let result
        let crypted_primaryid = encrypt(req.params.primaryid, JSON.parse(process.env.CIPHER));
        //hämta aktuell användares högsta löpnummer
        result = await Model.readHoldShelfMaxNo(crypted_primaryid)
        if(result.length > 0) {
            for (const row of result) {
                currentnumber = row.number
            }
        } else {
            currentnumber = 0;
        }
        //hämta aktuell användare och additional_id
        result = await Model.readHoldShelfUser(crypted_primaryid, req.params.additional_id )
        //Lägg till ny rad med uppräknat löpnummer om användaren + additional_id inte finns
        if(result.length == 0) {
            result = await Model.insertHoldShelfNo(crypted_primaryid, currentnumber + 1, req.params.additional_id )
        }

        //Hämta den uppdaterade användaren
        result = await Model.readHoldShelfUser(crypted_primaryid, req.params.additional_id )
        if(result.length > 0) {
            for (const row of result) {
                holdshelfnumber = zeroPad(row.number, 3);
                userid_encrypted = row.userid_encrypted;
            }
        }

        
        var data = {
            "records": result.length,
            "holdshelfnumber": holdshelfnumber,
            "userid_encrypted": userid_encrypted
        };
        xmlres = js2xmlparser.parse("holdshelfnumber",data);
        res.type('application/xml');
        res.send(xmlres);

    } catch (err) {
        res.send("error: " + err)
    }
}

async function callAlmaApi(endpointurl, lang = 'sv') {
    const almaresponse = await axios.get(endpointurl)
}

async function webhook(req, res, next) {
    try {
        logger.info("Alma webhook");
        if (!validateSignature(req.body,
            process.env.WEBHOOKSECRET,
            req.get('X-Exl-Signature'))) {
            logger.info("Invalid Signature");
            return res.status(401).send({ errorMessage: 'Invalid Signature' });
        }

        let job_instance_filename = '';
        logger.debug(JSON.stringify(req.body))
        var action = req.body.action.toLowerCase();
        switch (action) {
            case 'JOB_END':
            case 'job_end':
                // Export Electronic portfolios
                if (typeof req.body.job_instance !== 'undefined') {
                    if (typeof req.body.job_instance.job_info !== 'undefined') {
                        if (typeof req.body.job_instance.job_info.id !== 'undefined') {
                            if(req.body.job_instance.job_info.id == 'M47') {
                                if((req.body.job_instance.counter)) {
                                    for (let i=0; i<req.body.job_instance.counter.length; i++) {
                                        if(req.body.job_instance.counter[i].type.value == "c.jobs.bibExport.link") {
                                            job_instance_filename = req.body.job_instance.counter[i].value;
                                        }
                                    }
                                }
                                //Zippa filen och skicka till Libris
                                if(job_instance_filename != '') {
                                    sendFileToFtp({
                                        "ftp_server": process.env.FTP_SERVER_LIBRIS,
                                        "ftp_user": process.env.FTP_USER_LIBRIS,
                                        "ftp_password": process.env.FTP_PASSWORD_LIBRIS,
                                        "zip_file": process.env.TDIG_ZIP_FILE,
                                        "txt_file": job_instance_filename
                                    })
                                }
                            }
                        }
                    }
                }
                break;

            default:
        }
    } catch(err) {
        console.log(err)
    }

    res.status(204).send();
}

//Autocomplete till Primos sökruta
async function getPrimoAutoComplete(req, res) {
    try {
        if (req.query.q) {
            let autocomplete = await axios.get(`http://primo-instant-eu.hosted.exlibrisgroup.com:1997/solr/ac?q=${req.query.q}&rows=${req.query.rows || 15}&wt=json`)
            res.json(autocomplete.data);
        }
        else {
            res.json('Please provide a search term q (ex: q=java)');
        }
    } catch (err) {
        res.json(err.message);
    }  
}

//Aktivera almakonto via Primo
async function ActivatePatron(req, res) {

    let decodedtoken
    try {
        decodedtoken = await verifyexlibristoken(req.query.jwt)
    } catch(err) {
        console.log(err)
    }

    if (decodedtoken!=0) {
        try {
            //hämta user objekt
            almapiurl = process.env.ALMAPIENDPOINT + 'users/' + decodedtoken.userName + '?apikey=' + process.env.ALMAAPIKEY
            const almauser = await axios.get(almapiurl)
            if(almauser.data.user_group.value == 10 || almauser.data.user_group.value == 20 || almauser.data.user_group.value == 40 ||
                almauser.data.user_group.value == "10" || almauser.data.user_group.value == "20" || almauser.data.user_group.value == "40" ) {
                //Lägg till user note i hämtat userobjekt
                almauser.data.user_note.push({
                    "note_type": {
                        "value": "POPUP",
                        "desc": "General"
                    },
                    "note_text": "Activated from Primo",
                    "segment_type": "Internal"
                })
                //Uppdatera patron rollen i hämtat userobjekt till att vara aktiv
                let patronrole = false
                for (let index = 0; index < almauser.data.user_role.length; index++) {
                    const element = almauser.data.user_role[index].role_type.desc;
                    if(element.indexOf("Patron") !== -1) {
                        almauser.data.user_role[index].status.desc="Active"
                        almauser.data.user_role[index].status.value="ACTIVE"
                        result = "OK"
                        patronrole = true
                        break;
                    }
                }
                if(!patronrole) {
                    res.status(400)
                    res.json("User does not have a patron role!");
                    return;
                }
                //Uppdatera pincode
                if(req.body.pin_number) {
                    almauser.data.pin_number = req.body.pin_number
                } else {
                    res.status(400)
                    res.json("Error, No pincode provided")
                    return;
                }

                //Uppdatera preferred language
                if(req.body.language_value && req.body.language_desc) {
                    almauser.data.preferred_language.value = req.body.language_value
                    almauser.data.preferred_language.desc = req.body.language_desc
                } else {
                    res.status(400)
                    res.json("Error, No preferred language provided")
                    return;
                }
                
                const almaresult = await axios.put(almapiurl, almauser.data)

                res.json("success");
            } else {
                res.status(400)
                res.json("Error, Not a KTH user.")
                return;
            }
        } catch(err) {
            res.status(400)
            res.json(err.message)
            console.log(err)
        }
    } else {
        res.status(400)
        res.json("None or not valid token")
}
    
}

//
async function getCitationDataFromWoS(req, res) {
    if (req.query.doi) {
        try {
            let xml = `<?xml version="1.0" encoding="UTF-8" ?>
                        <request xmlns="http://www.isinet.com/xrpc42" src="app.id=API">
                            <fn name="LinksAMR.retrieve">
                                <list>
                                    <map>
                                        <val name="username">${process.env.WOS_USER}</val>
                                        <val name="password">${process.env.WOS_PASSWORD}</val>
                                    </map>
                                    <!-- WHAT IS REQUESTED -->
                                    <map>
                                        <list name="WOS">
                                            <val>timesCited</val>
                                            <val>ut</val>
                                            <val>doi</val>
                                            <val>pmid</val>
                                            <val>sourceURL</val>
                                            <val>citingArticlesURL</val>
                                            <val>relatedRecordsURL</val>
                                        </list>
                                    </map>
                                    <!-- LOOKUP DATA -->
                                    <map>
                                        <!-- QUERY "cite_1" -->
                                        <map name="cite_1">
                                            <val name="doi">${req.query.doi}</val>
                                        </map> <!-- end of cite_1-->      
                                    </map> <!-- end of citations -->
                                </list>
                            </fn>
                        </request>`
            let wos = await axios.post(process.env.WOS_URL,xml)
            const xmlData = wos.data;

            let json
            xml2jsparser.parseString(xmlData, (err, result) => {
                if (err) {
                    console.error('Error parsing XML:', err);
                    res.json('Error parsing XML:', err);
                    return;
                }
                if (!result.response.fn[0].map[0].map[0].map[0].val.find(item => item.$.name === 'message')) {
                    const timesCited = result.response.fn[0].map[0].map[0].map[0].val.find(item => item.$.name === 'timesCited')._;
                    const sourceURL = result.response.fn[0].map[0].map[0].map[0].val.find(item => item.$.name === 'sourceURL')._;
                    const citingArticlesURL = result.response.fn[0].map[0].map[0].map[0].val.find(item => item.$.name === 'citingArticlesURL')._;
                    json = {
                        "wos": {
                            "timesCited": timesCited,
                            "sourceURL": sourceURL,
                            "citingArticlesURL": citingArticlesURL 
                        }
                    }
                } else {
                    json = {
                        "wos": {
                            "timesCited": "",
                            "sourceURL": "",
                            "citingArticlesURL": "" 
                        }
                    }
                }
                res.send(json);
            });
        } catch (err) {
            res.json(err.message);
        }
    } else {
        res.json('Please provide a doi parameter(?doi=xxxxx)');
    }
}

//
async function getCitationDataFromScopus(req, res) {
    if (req.query.doi) {
        try {
            let elsevier = await axios.post(process.env.ELSEVIER_URL + `?query=DOI(${req.query.doi})&field=citedby-count`,
                    {}, {
                            headers:{
                                'X-ELS-APIKey': process.env.ELSEVIER_APIKEY,
                                'Accept': 'application/json'
                            }
                        })

            let json
            let sourceURL

            if(elsevier.data['search-results']['opensearch:totalResults'] > 0) {
                let xmlresp = await axios.post(elsevier.data['search-results'].entry[0]['prism:url'])
                for(i=0;i<xmlresp.data['abstracts-retrieval-response'].coredata.link.length;i++) {
                    sourceURL = xmlresp.data['abstracts-retrieval-response'].coredata.link[i]['@href']
                }
                json = {
                    "elsevier": {
                        "timesCited": elsevier.data['search-results'].entry[0]['citedby-count'],
                        "sourceURL": sourceURL,
                        "citingArticlesURL": "" 
                    }
                }
            } else {
                json = {
                    "elsevier": {
                        "timesCited": "",
                        "sourceURL": "",
                        "citingArticlesURL": "" 
                    }
                }
            }
            res.send(json);
        } catch (err) {
            res.json(err.message);
        }
    } else {
        res.json('Please provide a doi parameter(?doi=xxxxx)');
    }
}

//Netsbetalningar
async function readPayment(payment_id) {
    try {
        result = await Model.readPayment(payment_id)
        return result;
    } catch (err) {
        console.log(err.message)
        return "error: " + err.message
    }
}

async function createPayment(payment_id, primary_id, fee_id) {
    try {
        let result = await Model.createPayment(payment_id, primary_id, fee_id)
        return result
    } catch (err) {
        console.log(err.message)
        return "error: " + err.message
    }
}

async function updatePayment(payment_id, finished) {
    try {
        let result = await Model.updatePayment(payment_id, finished)
        return result
    } catch (err) {
        console.log(err.message)
        return "error: " + err.message
    }
}

//Funktioner

//Anropas av webhook när almajobbet för TDIG är klart.
async function sendFileToFtp(config) {
    try {
        console.log(new Date().toLocaleString());
        console.log("Starting ftp...")
        const client = new ftp.Client();

        try {
            await client.access({
                host: config.ftp_server,
                port: 21,
                user: config.ftp_user,
                password: config.ftp_password
            });
            
            console.log("Downloading txt-file from ftp-server...")
            let download_ftp_file = await client.downloadTo(path.join('./', config.txt_file), config.txt_file)
            console.log(download_ftp_file)

            console.log("Zipping txt-file...")
            const zipStream = fs.createWriteStream(config.zip_file);
            const zipArchive = archiver('zip');
            zipArchive.pipe(zipStream);
            const filePath = path.join('./', config.txt_file);
            zipArchive.append(fs.createReadStream(filePath), { name: config.txt_file });
            let zip_result = await zipArchive.finalize();
            console.log("Zipping finished...")

            console.log('Uploading zip-file to ftp-server...');
            let ftp_upload = await client.uploadFrom(config.zip_file, config.zip_file);
            console.log(ftp_upload)

            console.log('Removing txt-file from ftp-server...');
            let ftp_file_delete = await client.remove(config.txt_file)
            console.log(ftp_file_delete)

            try {
                console.log('Removing local txt file');
                let local_file_delete = fs.unlinkSync(path.join('./', config.txt_file))
                console.log(`Local file ${config.txt_file} deleted`);
            } catch(err) {
                console.log(err)
            }

            try {
                console.log('Removing local zip file');
                let local_file_delete = fs.unlinkSync(path.join('./', config.zip_file))
                console.log(`Local file ${config.zip_file} deleted`);
                console.log(new Date().toLocaleString());
            } catch(err) {
                console.log(err)
            }
            
        } catch (err) {
            console.error('FTP error:', err);
            return "error"
        } finally {
            client.close();
            return "success"
        }
    } catch(err) {
        console.log(err)
        return "error"
    }
}

function validateSignature(body, secret, signature) {
    var hash = crypto.createHmac('SHA256', secret)
      .update(JSON.stringify(body))
      .digest('base64');
    return (hash === signature);
}

function zeroPad(num, places) {
    var zero = places - num.toString().length + 1;
    return Array(+(zero > 0 && zero)).join("0") + num;
}

function encrypt(plainstr, cipher)
{    
  var plainArr = plainstr.split('');
  var cryptArr = new Array(plainArr.length);

  for(var i=0;i<cryptArr.length;i++){
     cryptArr[i] = String.fromCharCode(cipher[plainArr[i].charCodeAt(0)-32]);
  }

  return cryptArr.join("");
}

function decrypt(cryptstr)
{
  var cryptArr = cryptstr.split('');
  var plainArr = new Array(cryptArr.length);

  for(var i=0;i<plainArr.length;i++){
     plainArr[i] =  String.fromCharCode(plain[cipher.indexOf(cryptArr[i].charCodeAt(0))]);
  }

  return plainArr.join("");
}

function truncate(str, max, suffix) {
    return str.length < max ? str : `${str.substr(0, str.substr(0, max - suffix.length).lastIndexOf(' '))}${suffix}`;
}

function formatDateForHTMLWeekDays(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}/${month}`;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getFirstDayOfWeek(date) {
    const day = date.getDay();
    const diff = (day + 6) % 7;
    date.setDate(date.getDate() - diff);
    return formatDate(date);
}

function getLastDayOfWeek(date) {
    const firstDayOfWeek = new Date(getFirstDayOfWeek(date));
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
    return formatDate(lastDayOfWeek);
}

async function makeHttpRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(`Error: Received status code ${res.statusCode}`);
                } else {
                    resolve(data);
                }
            });
        });

        req.on('error', (error) => reject(`Error during request: ${error}`));

        if (body) req.write(body);
        req.end();
    });
}


module.exports = {
    readNewbooks,
    getAlmaBib,
    getLibrisBib,
    getUpdatedLibrisBib,
    getlibrisLS,
    getHoldShelfNo,
    webhook,
    getPrimoAutoComplete,
    ActivatePatron,
    getCitationDataFromWoS,
    getCitationDataFromScopus,
    readPayment,
    createPayment,
    updatePayment
};

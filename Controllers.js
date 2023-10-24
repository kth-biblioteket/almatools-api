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

const translations = require('./translations/translations.json');

//Hämta nya böcker från tabellen "newbooks"
async function readNewbooks(req, res) {
    try {
        let result = await Model.readNewbooks(req)
        res.send(result)
    } catch (err) {
        res.send("error: " + err)
    }
}

// Lista som visar nya böcker på https://www.kth.se/biblioteket/soka-vardera/nya-bocker-pa-kth-biblioteket-1.1175846
// Kodsnutt läggs in som html-block i polopoly
async function getNewbooksList(req, res) {
    try {
        let result = await Model.readNewbooks(req)
        let lang = req.query.lang || 'sv'
        let almatoolsconfig = {
            showwithnocover : req.query.showwithnocover || 'true',
            primoview :  req.query.primoview || '46KTH_VU1_L',
            target: req.query.target || '_blank',
            nroftitlestoshow : parseInt(req.query.nroftitlestoshow) || 20,
            min_publication_date: req.query.minpublicationdate || '2020-05-01',
            booktype: req.query.booktype || 'all',
            lang: req.query.lang || 'sv',
            bookitemtype_P_text : translations[lang].bookitemtype_P_text,
            bookitemtype_E_text : translations[lang].bookitemtype_E_text,
            bookitempublishedtext : translations[lang].bookitempublishedtext,
            bookimageurl: process.env.BOOKIMAGEURL,
            book200imageurl: process.env.BOOK200IMAGEURL,
            nojquery: req.query.nojquery || false,
            nostyle: req.query.nostyle || false
        }
        res.render('pages/newbookslist', 
        {
            almatoolsconfig: almatoolsconfig, 
            rows: result 
        })
    } catch (err) {
        res.send("error: " + err)
    }
}

// Karusell som visar nya böcker på https://www.kth.se/biblioteket
// Kodsnutt läggs in som html-block i polopoly
async function getNewbooksCarousel(req, res) {
    try {
        let result = await Model.readNewbooks(req)
        let primoview = req.query.primoview || '46KTH_VU1_L'
        let target = req.query.target || '_blank'
        let lang = req.query.lang || 'sv'
        let books = [];
        let image;
        let booktype;
        let nroftitlestoshow;
        (nroftitlestoshow > result.length ? nroftitlestoshow = result.length : nroftitlestoshow = parseInt(req.query.nroftitlestoshow))
        for (i=0;i<nroftitlestoshow;i++) {
            (result[i].booktype == "P") ? booktype = translations[lang].bookitemtype_P_text : booktype = translations[lang].bookitemtype_E_text;
            if (result[i].coverurl && result[i].coverurl != process.env.BOOKIMAGEURL) {
                image = result[i].coverurl
            } else {
                image = ''
            }
            books.push({
                link: `https://kth-ch.primo.exlibrisgroup.com/discovery/fulldisplay?vid=46KTH_INST:${primoview}&docid=alma${result[i].mmsid}&lang=${lang}`,
                image: image,
                title: result[i].title.replace('/', '').trim().substring(0,150),
                description: booktype,
                target: target,
                authors: [ result[i].subject ]
            });
        }
        let almatoolsconfig = {
            showwithnocover : req.query.showwithnocover || 'true',
            nocoverfontsize : req.query.nocoverfontsize || 20,
            carouseltype : req.query.carouseltype || 'carousel',
            stepInterval: req.query.stepInterval||"5000",
            stepDuration: req.query.stepDuration||"2000",
            maxshelfheight: req.query.maxshelfheight||"150",
            bookimageurl: process.env.BOOKIMAGEURL,
            book200imageurl: process.env.BOOK200IMAGEURL,
            nojquery: req.query.nojquery || false,
        }
        
        res.render('pages/newbookscarousel', 
        {
            almatoolsconfig: almatoolsconfig, 
            rows: result,
            books: books
        })
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
	
        if ((req.query.ISBN || req.query.ONR || req.query.ISSN) && req.query.library) {
            if (req.query.ISBN != '') {
                sru = `https://eu01.alma.exlibrisgroup.com/view/sru/46KTH_INST?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.isbn="${req.query.ISBN}"&maximumRecords=10`
            } else if (req.query.ONR != '') {
                sru = `https://eu01.alma.exlibrisgroup.com/view/sru/46KTH_INST?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.isbn="${req.query.ONR}"&maximumRecords=10`
            } else if (req.query.ISSN != '') {
                sru = `https://eu01.alma.exlibrisgroup.com/view/sru/46KTH_INST?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.issn="${req.query.ISSN}"&maximumRecords=10`
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
                                        let locationcode = items.item[i]['item_data']['location']['value'];
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
        if (!validateSignature(req.body,
            process.env.WEBHOOKSECRET,
            req.get('X-Exl-Signature'))) {
            return res.status(401).send({ errorMessage: 'Invalid Signature' });
        }

        let job_instance_filename = '';
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

//Aktivera almakonto
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
//Funktioner

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

async function verifyexlibristoken(tokenValue) {
    try {
        const exlibrisjwks = await axios.get(process.env.EXLIBRISPUBLICKEY_URL)
        var pem = jwkToPem(exlibrisjwks.data.keys[1]);
        var token = jwt.verify( tokenValue, pem )
        return token
    } catch(err) {
        console.log(err)
        return 0
    }

}

module.exports = {
    readNewbooks,
    getNewbooksList,
    getNewbooksCarousel,
    getlibrisLS,
    getHoldShelfNo,
    webhook,
    getPrimoAutoComplete,
    ActivatePatron,
    getCitationDataFromWoS,
    getCitationDataFromScopus
};

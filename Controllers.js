const Model = require('./Models');

const translations = require('./translations/translations.json');

async function readNewbooks(req, res) {
    try {
        let result = await Model.readNewbooks(req)
        res.send(result)
    } catch (err) {
        res.send("error: " + err)
    }
}

async function getNewbooksList(req, res) {
    try {
        let result = await Model.readNewbooks(req)
        let lang = req.query.lang || 'sv'
        let config = {
            nroftitlestoshow : parseInt(req.query.nroftitlestoshow) || 20,
            min_publication_date: req.query.minpublicationdate || '2020-05-01',
            booktype: req.query.booktype || 'all',
            lang: lang,
            bookitemtype_P_text : translations[lang].bookitemtype_P_text,
            bookitemtype_E_text : translations[lang].bookitemtype_E_text,
            bookitempublishedtext : translations[lang].bookitempublishedtext
        }
        console.log(config)
        res.render('pages/newbookslist', 
        {
            config: config, 
            rows: result 
        })
    } catch (err) {
        res.send("error: " + err)
    }
}

async function getNewbooksCarousel(req, res) {
    try {
        let result = await Model.readNewbooks(req)
        let lang = req.query.lang || 'sv'
        let books = [];
        let image;
        let booktype;
        for (i=0;i<result.length;i++) {
            (result[i].booktype == "P") ? booktype = translations[lang].bookitemtype_P_text : booktype = translations[lang].bookitemtype_E_text;
            if (result[i].coverurl && result[i].coverurl != 'https://api-ref.lib.kth.se/almatools/images/book.png') {
                image = result[i].coverurl
            } else {
                image = ''
            }
            books.push({
                link: `https://kth-ch.primo.exlibrisgroup.com/discovery/fulldisplay?vid=46KTH_INST:46KTH_VU1_L&docid=alma${result[i].mmsid}&lang=${lang}`,
                image: image,
                title: result[i].title.replace('/', '').trim().substring(0,150),
                description: booktype,
                target: "_new",
                authors: [ result[i].subject ]
            });
        }
        let config = {
            nocoverfontsize : req.query.nocoverfontsize || 20,
            carouseltype : req.query.carouseltype || 'carousel',
            stepInterval: req.query.stepInterval||"5000",
            stepDuration: req.query.stepDuration||"2000"
        }
        
        res.render('pages/newbookscarousel', 
        {
            config: config, 
            rows: result,
            books: books
        })
    } catch (err) {
        res.send("error: " + err)
    }
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

module.exports = {
    readNewbooks,
    getNewbooksList,
    getNewbooksCarousel
};

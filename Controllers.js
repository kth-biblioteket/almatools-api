const Model = require('./Models');

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
        res.render('pages/newbookslist', 
        {
            config: {
                nroftitlestoshow : 20,
                min_publication_date: '2023-05-01',
                booktype: 'all',
                lang: 'sv',
                bookitemtype_P_text : 'PBOOK',
                bookitemtype_E_text : 'EBOOK',
                bookitempublishedtext : "Pub: "
            }, 
            rows: result 
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
    getNewbooksList
};

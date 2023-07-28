//
//
// https://bitbucket.org/curtin-library/virtual-bookshelf/src/master/
//
//

(function () {

    // Hämta eventuella parametrar som angivits från anropande sida.

    window.$newbooks.custom_texts.START_TEXT = window.$newbooks.custom_texts.START_TEXT || ''

    window.$newbooks = window.$newbooks || {};

    window.$newbooks.min_publication_date = window.$newbooks.min_publication_date||0;

    //Aktiveringsdatum(default?)
    window.$newbooks.activationdate = window.$newbooks.activationdate||"2000-01-01";

    //Booktyp P=Printed, E=Online
    window.$newbooks.booktype = window.$newbooks.booktype||"all";

    //antal titlar att visa (default?)
    window.$newbooks.nroftitlestoshow = window.$newbooks.nroftitlestoshow||"10";

    window.$newbooks.dewey = window.$newbooks.dewey||"";

    window.$newbooks.lang = window.$newbooks.lang||"en";

    window.$newbooks.widgettype = window.$newbooks.widgettype||"list";

    window.$newbooks.carouseltype = window.$newbooks.carouseltype||"carousel";

    window.$newbooks.shelfheight = window.$newbooks.shelfheight||"150";

    //Bildhöjd på puff fullscreen(>960px?) i polopoly = 150px
    window.$newbooks.maxshelfheight = window.$newbooks.maxshelfheight||"150";

    window.$newbooks.nocoverfontsize = window.$newbooks.nocoverfontsize||"20";

    window.$newbooks.stepInterval = window.$newbooks.stepInterval||"5000";

    window.$newbooks.stepDuration = window.$newbooks.stepDuration||"2000";

    var ss = document.createElement("link");
    ss.type = "text/css";
    ss.rel = "stylesheet";
    ss.href = "/almatools/css/style.css";
    document.getElementsByTagName("head")[0].appendChild(ss);

    
    //Skapa lista eller karusell beroende på angiven typ
    switch(window.$newbooks.widgettype) {
        case 'list':
            createbooklist();
            break;
        case 'carousel':
            createbookcarousel(window.$newbooks.carouseltype);
            break;
        default:
            createbooklist();
    }
   
}());

function createbooklist() {

    var endpoint = "https://api-ref.lib.kth.se/almatools/v1/newbooks?activationdate=" + window.$newbooks.activationdate;
    if(window.$newbooks.dewey) {
        endpoint += '&dewey=' + window.$newbooks.dewey; 
    }
    var apiKey = '';

    //Språkanpassning
    if(window.$newbooks.lang == 'sv') {
        bookitempublishedtext = 'Utgiven: ';
        bookitemtype_E_text = 'E-bok';
        bookitemtype_P_text = 'Tryckt bok';
    } else {
        bookitempublishedtext = 'Published: ';
        bookitemtype_E_text = 'E-book';
        bookitemtype_P_text = 'Printed book';
    }


    //Parametrar från adminverktyg?

    // Hämta data från API och skapa HTML
    var request = new XMLHttpRequest();
    request.open("GET", endpoint, true);
    request.setRequestHeader("Content-type", "application/json");

    request.onload = function () {
        if (request.readyState == XMLHttpRequest.DONE && request.status == 200) {
            var nocoverurl = "https://api-ref.lib.kth.se/almatools/images/book.png";
            var response = JSON.parse(request.response);
            var booktype = "";
            var nroftitlestoshow;
            var template = "";
            if (window.$newbooks.custom_texts.START_TEXT !== '') {
                template +=`<h2>${window.$newbooks.custom_texts.START_TEXT}</h2>`
            }
            
            template +=`<div class='newbooks'>`;

            if (window.$newbooks.nroftitlestoshow < response.length) {
                nroftitlestoshow = window.$newbooks.nroftitlestoshow
            } else {
                nroftitlestoshow = response.length
            }
            for (i = 0; i < nroftitlestoshow; i++) {
                (response[i].booktype == "P") ? booktype = bookitemtype_P_text : booktype = bookitemtype_E_text;
                if (response[i].publicationdate >= window.$newbooks.min_publication_date) {
                    if (response[i].booktype == window.$newbooks.booktype || window.$newbooks.booktype == "all") {
                        template +=
                            `<div class="bookitem">
                                <div class="bookcover">`
                                if (response[i].coverurl && response[i].coverurl != 'https://api-ref.lib.kth.se/almatools/images/book.png') {
                                    template += `<img class="bookcoverimage" src="${response[i].coverurl}">`
                                } else {
                                    template += `<div class="shape">${response[i].title.replace('/', '').trim().substring(0,150)}</div>`
                                }  
                        template += 
                                `</div>
                                <div class="bookdata">
                                    <div class="bookitemtitle">
                                        <a target="_new" href="https://kth-ch.primo.exlibrisgroup.com/discovery/fulldisplay?vid=46KTH_INST:46KTH_VU1_L&docid=alma${response[i].mmsid}&lang=${window.$newbooks.lang}">
                                            ${response[i].title.replace('/', '').trim()}
                                        </a>
                                    </div>
                                    <!--div>
                                        <div>ISBN:</div> 
                                        <div>${response[i].isbnprimo ? response[i].isbnprimo : response[i].isbn}</div>
                                    </div>
                                    <div>
                                        <div>Date added:</div> 
                                        <div>${response[i].activationdate.substr(0, 10)}</div>
                                    </div-->
                                    <div>
                                        <span>${bookitempublishedtext} ${response[i].publicationdate}</span>
                                    </div>
                                    <div>
                                        <span>${booktype}</span>
                                    </div>
                                </div>
                            </div>`
                    }
                }
            }
            
            template += "</div>";

            // Hitta container som måste finnas på sidan som ska visa widgeten.
            var newbooksContainer = document.querySelector(".kthbnewbooks");

            if (newbooksContainer) {
                // Lägg in HTML på anropande sida.
                newbooksContainer.insertAdjacentHTML('afterbegin', template);
            }

        }
    };

    request.send();
}

function createbookcarousel(type) {

    var endpoint = "https://api-ref.lib.kth.se/almatools/v1/newbooks?activationdate=" + window.$newbooks.activationdate;
    var apiKey = '';

    //Språkanpassning
    if(window.$newbooks.lang == 'sv') {
        bookitempublishedtext = 'Utgiven: ';
        bookitemtype_E_text = 'E-bok';
        bookitemtype_P_text = 'Tryckt bok';
    } else {
        bookitempublishedtext = 'Published: ';
        bookitemtype_E_text = 'E-book';
        bookitemtype_P_text = 'Printed book';
    }

    //Parametrar från adminverktyg?

    // Hämta data från API och skapa HTML
    var request = new XMLHttpRequest();
    request.open("GET", endpoint, true);
    request.setRequestHeader("Content-type", "application/json");

    request.onload = function () {
        if (request.readyState == XMLHttpRequest.DONE && request.status == 200) {
            var nocoverurl = "https://api-ref.lib.kth.se/almatools/images/book.png";
            var response = JSON.parse(request.response);
            var booktype = "";
            var books = [];
            var image = "";
            var nroftitlestoshow;
            var template = "";
            if (window.$newbooks.custom_texts.START_TEXT !== '') {
                template +=`<h2>${window.$newbooks.custom_texts.START_TEXT}</h2>`
            }
            
            template +=`<div class='newbooks'>
                            <div id="bookshelf" class="kthbookshelf"></div>`;
                                    if (window.$newbooks.nroftitlestoshow < response.length) {
                                        nroftitlestoshow = window.$newbooks.nroftitlestoshow
                                    } else {
                                        nroftitlestoshow = response.length
                                    }
                                    for (i = 0; i < nroftitlestoshow; i++) {
                                        (response[i].booktype == "P") ? booktype = bookitemtype_P_text : booktype = bookitemtype_E_text;

                                        if (response[i].coverurl && response[i].coverurl != 'https://api-ref.lib.kth.se/almatools/images/book.png') {
                                            image = response[i].coverurl
                                        } else {
                                            image = ''//`https://apps.lib.kth.se/images/book.png?${response[i].i}`
                                        }
                                        books.push({
                                            link: `https://kth-ch.primo.exlibrisgroup.com/discovery/fulldisplay?vid=46KTH_INST:46KTH_VU1_L&docid=alma${response[i].mmsid}&lang=${window.$newbooks.lang}`,
                                            image: image,
                                            title: response[i].title.replace('/', '').trim().substring(0,150),
                                            description: booktype,
                                            target: "_new",
                                            authors: [ response[i].subject ]
                                        });
                                    }
                template += `</div>
                        </div>`
            // Hitta container som måste finnas på sidan som ska visa widgeten.
            var newbooksContainer = document.querySelector(".kthbnewbooks");

            if (newbooksContainer) {
                // Lägg in HTML på anropande sida.
                newbooksContainer.insertAdjacentHTML('afterbegin', template);
            }

            //Sätt höjd på karusell beroende på bredd
            jQuery(".kthbookshelf").height(parseInt(jQuery(".kthbookshelf").width())/1.6)

           //Sätt storlek på font beroende på bredd på karusell
            if (parseInt(jQuery(".kthbookshelf").width()) < 200 ) {
                jQuery(".kthbookshelf").css('fontSize', 6);
            } else if (parseInt(jQuery(".kthbookshelf").width()) < 500 ) {
                jQuery(".kthbookshelf").css('fontSize', 9);
            } else {
                jQuery(".kthbookshelf").css('fontSize', parseInt(window.$newbooks.nocoverfontsize));
            }

            jQuery(".kthbookshelf").css('maxHeight', parseInt(window.$newbooks.maxshelfheight));

            window.$newbooks.books = books;
            carousel_load() 

        }
    };

    request.send();
    
}

function carousel_load() {
    jQuery.ajax({
        url: 'https://api-ref.lib.kth.se/almatools/js/kthbbookshelf.js',
        dataType: 'script',
        cache: true,
        success: function() {
            window.$newbooks.bookarraystream = new VirtualBookshelf.ArrayStream(window.$newbooks.books)
            window.addEventListener('resize', function() {
                clearTimeout(resizeId);
                resizeId = setTimeout(doneResizing, 500);
            });
            carousel_start()
        }
    });
}

//Anpassa till ny storlek på browser
var resizeId;
function doneResizing(){
    var x = document.getElementById("bookshelf");
    //Sätt höjd på karusell beroende på bredd
    jQuery(".kthbookshelf").height(parseInt(jQuery(".kthbookshelf").width())/1.6)

    //Sätt storlek på font beroende på bredd på karusell
    if (parseInt(jQuery(".kthbookshelf").width()) < 200 ) {
        jQuery(".kthbookshelf").css('fontSize', 6);
    } else if (parseInt(jQuery(".kthbookshelf").width()) < 500 ) {
        jQuery(".kthbookshelf").css('fontSize', 8);
    } else {
        jQuery(".kthbookshelf").css('fontSize', parseInt(window.$newbooks.nocoverfontsize));
    }
    //rensa listan
    x.innerHTML = "";
    //Kopiera den tomma listan men INTE de eventlisteners som finns
    x.replaceWith(x.cloneNode(true));
    //Starta om karusell
    carousel_start();
}

function carousel_start() {
    if(window.$newbooks.carouseltype == 'carousel') {
        window.$newbooks.bookshelfobject = new VirtualBookshelf.Carousel('#bookshelf', {
            itemAspect: 0.8,
            perspective: 0.6,
            spacing: 1.15,
            tilt: -0.02,
            stream: window.$newbooks.bookarraystream
        });
    }
    if(window.$newbooks.carouseltype == 'train') {
        window.$newbooks.bookshelfobject = new VirtualBookshelf.Train('#bookshelf', {
            itemAspect: 0.7,
            spacing: 1.15,
            unfocusedScale: 0.6,
            stepInterval: window.$newbooks.stepInterval,
            stepDuration: window.$newbooks.stepDuration,
            stream: window.$newbooks.bookarraystream
        });
    }
}
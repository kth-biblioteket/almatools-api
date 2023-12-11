const database = require('./db');

//Hämta alla böcker från och med aktiveringsdatum
const readNewbooks = (req) => {
    let showwithnocover = req.query.showwithnocover || 'true'
    let coverurl = '%images/book.png%'

    if(showwithnocover === 'true') {
        coverurl = '%nocoverurl%'
    }
    let activationdate = req.query.activationdate || '2020-01-01';
    let publicationdate = req.query.publicationdate || '2020';
    let sql = `SELECT id, mmsid, recordid, isbn, isbnprimo, thumbnail, coverurl, 
                    title, DATE_FORMAT(activationdate, "%Y-%m-%d") as activationdate, 
                    publicationdate, dewey, subject, category, subcategory, booktype 
                    FROM newbooks
                    WHERE activationdate >= ?
                    AND  cast(publicationdate AS SIGNED) >= ?
                    AND coverurl NOT LIKE ?
                    ORDER BY activationdate DESC`;
  
      /*
    if(req.query.activationdate) {
        sql += ` AND activationdate >= '${req.query.activationdate}'`
    }
  
    if(req.query.publicationdate) {
        sql += ` AND  cast(publicationdate AS SIGNED) >= ${req.query.publicationdate}`
    }
  
    if(req.query.booktype) {
        sql += ` AND booktype = '${req.query.booktype}'`
    }
  
    if(req.query.dewey) {
        if (req.query.dewey.length == 1) {
            sql += ` AND (dewey LIKE '${req.query.dewey}__.%' OR dewey LIKE '${req.query.dewey}__/%')`
        }
        if (req.query.dewey.length == 2) {
            sql += ` AND (dewey LIKE '${req.query.dewey}_.%' OR dewey LIKE '${req.query.dewey}_/%')`
        }
        if (req.query.dewey.length == 3) {
            sql += ` AND (dewey LIKE '${req.query.dewey}.%' OR dewey LIKE '${req.query.dewey}/%')`
        }
        
    }
    */
  
    //sql += ` ORDER BY activationdate DESC`;
  
    return new Promise(function (resolve, reject) {    
        database.db.query(database.mysql.format(sql,[activationdate, publicationdate, coverurl]),(err, result) => {
            if(err) {
              console.error('Error executing query:', err);
              reject(err.message)
            }
            const successMessage = "Success"
            resolve(result);
        });
    })
};

//Hämta användarens högsta löpnummer
const readHoldShelfMaxNo = (crypted_primaryid) => {

    sql = `SELECT max(number) AS number 
            FROM holdshelfnumber
            WHERE userid_encrypted = ?`;
  
    return new Promise(function (resolve, reject) {    
        database.db.query(database.mysql.format(sql,[crypted_primaryid]),(err, result) => {
            if(err) {
              console.error('Error executing query:', err);
              reject(err.message)
            }
            const successMessage = "Success"
            resolve(result);
        });
    })
};

//Hämta användarens högsta löpnummer
const readHoldShelfUser = (crypted_primaryid, additional_id) => {
    sql = `SELECT * 
    FROM holdshelfnumber
    WHERE userid_encrypted = ? AND additional_id = ?`;
  
    return new Promise(function (resolve, reject) {    
        database.db.query(database.mysql.format(sql,[crypted_primaryid, additional_id]),(err, result) => {
            if(err) {
              console.error('Error executing query:', err);
              reject(err.message)
            }
            const successMessage = "Success"
            resolve(result);
        });
    })
}

//Hämta användarens högsta löpnummer
const insertHoldShelfNo = (crypted_primaryid, number, additional_id) => {
    sql = `INSERT INTO holdshelfnumber
    VALUES(?,?,?)`;
  
    return new Promise(function (resolve, reject) {    
        database.db.query(database.mysql.format(sql,[crypted_primaryid, number, additional_id]),(err, result) => {
            if(err) {
              console.error('Error executing query:', err);
              reject(err.message)
            }
            const successMessage = "Success"
            resolve(result);
        });
    })
}

//Hämta en betalning
const readPayment = (payment_id) => {
    return new Promise(function (resolve, reject) {
        const sql = `SELECT * FROM payments 
                    WHERE payment_id = ?`;
        database.db.query(database.mysql.format(sql,[payment_id]),(err, result) => {
            if(err) {
                console.error(err);
                reject(err.message)
            }
            resolve(result);
        });
    })
};

//Lägg till betalning
const createPayment = (payment_id, primary_id, fee_id) => {
    return new Promise(function (resolve, reject) {
        const sql = `INSERT INTO payments(payment_id, primary_id, fee_id)
                VALUES(?, ?, ?)`;
        database.db.query(database.mysql.format(sql,[payment_id, primary_id, fee_id]),(err, result) => {
            if(err) {
                console.error(err);
                reject(err.message)
            }
            const successMessage = "The payment was successfully created."
            resolve(successMessage);
        });
    })
};

//Uppdatera betalning
const updatePayment = (payment_id, finished) => {
    return new Promise(function (resolve, reject) {
        const sql = `UPDATE payments
                    SET finished = ?
                    WHERE payment_id = ?`;
        database.db.query(database.mysql.format(sql,[finished, payment_id]),(err, result) => {
            if(err) {
                console.error(err);
                reject(err.message)
            }
            const successMessage = "The payment was successfully updated."
            resolve(successMessage);
        });
    })
};

//Ta bort en betalning
const deletePayment = (payment_id) => {
    return new Promise(function (resolve, reject) {
        const sql = `DELETE FROM payments
                    WHERE payment_id = ?`;
        database.db.query(database.mysql.format(sql,[payment_id]),(err, result) => {
            if(err) {
                console.error(err);
                reject(err.message)
            }
            const successMessage = "The payment was successfully deleted."
            resolve(successMessage);
        });
    })
};

module.exports = {
    readNewbooks,
    readHoldShelfMaxNo,
    readHoldShelfUser,
    insertHoldShelfNo,
    readPayment,
    createPayment,
    updatePayment,
    deletePayment
};
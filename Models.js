const database = require('./db');

//Hämta alla böcker från och med aktiveringsdatum
const readNewbooks = (req) => {

  let activationdate = req.query.activationdate || '2000-01-01';
  let sql = `SELECT id, mmsid, recordid, isbn, isbnprimo, thumbnail, coverurl, 
                  title, DATE_FORMAT(activationdate, "%Y-%m-%d") as activationdate, 
                  publicationdate, dewey, subject, category, subcategory, booktype 
                  FROM newbooks
                  WHERE activationdate >= ?
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
      database.db.query(database.mysql.format(sql,[activationdate]),(err, result) => {
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

module.exports = {
  readNewbooks,
  readHoldShelfMaxNo,
  readHoldShelfUser,
  insertHoldShelfNo
};
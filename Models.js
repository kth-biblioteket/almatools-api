const database = require('./db');

//Hämta alla böcker från och med aktiveringsdatum
const readNewbooks = (req) => {

  //Bygg SQL utifrån parametrar
  let sql = `SELECT id, mmsid, recordid, isbn, isbnprimo, thumbnail, coverurl, 
                  title, DATE_FORMAT(activationdate, "%Y-%m-%d") as activationdate, 
                  publicationdate, dewey, subject, category, subcategory, booktype 
                  FROM newbooks
                  WHERE 1`;

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

  sql += ` ORDER BY activationdate DESC`;

  return new Promise(function (resolve, reject) {    
      database.db.query(database.mysql.format(sql),(err, result) => {
          if(err) {
            console.error('Error executing query:', err);
            reject(err.message)
          }
          const successMessage = "Success"
          resolve(result);
      });
  })
};

module.exports = {
  readNewbooks
};
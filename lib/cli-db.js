const fs = require('fs');
const path = require('path');

function getDbPath(cwd = process.cwd()) {
  return path.join(cwd, 'data', 'openbook.db');
}

function hasDb(cwd = process.cwd()) {
  return fs.existsSync(getDbPath(cwd));
}

function withDb(fn, options = {}) {
  const Database = require('better-sqlite3');
  const db = new Database(getDbPath(options.cwd), options.dbOptions || {});
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

module.exports = { getDbPath, hasDb, withDb };

var config = require('./config.json');
var sqlite3 = require('sqlite3').verbose();
var markdown = require( "markdown" ).markdown;

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function Database() {

}

Database.prototype.connect = function(callback) {
  var _this = this;
  _this.db = new sqlite3.Database(config.db.path+'/thoughts.sqlite3', function(err) {
    if (err) {
      console.log(err);
    } else {
      _this.install(callback);
    }
  });
}

Database.prototype.install = function(callback) {
  var _this = this;
  var tables = [
    'CREATE TABLE IF NOT EXISTS User (uid TEXT PRIMARY KEY, created INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS Thought (uid TEXT NOT NULL, thought TEXT NOT NULL, public INTEGER NOT NULL, category TEXT NOT NULL, created INTEGER NOT NULL, FOREIGN KEY(uid) REFERENCES User(uid))',
    'CREATE INDEX Thought_User ON Thought (uid)'
  ];
  var create = function() {
    var createStatement = tables.shift();
    if (createStatement) {
      _this.db.run(createStatement,create);
    } else {
      callback();
    }
  }
  create();
}

Database.prototype.findOrCreateUser = function(uid,callback) {
  var _this = this;
  _this.db.all('SELECT uid FROM User WHERE uid = ?',[uid],function(err,rows) {
    if (rows && rows.length > 0) {
      callback(null,rows[0]);
    } else if (err) {
      callback(err);
    } else {
      _this.db.run('INSERT INTO User (uid,created) VALUES(?,?)',[uid,new Date().getTime()],function(err) {
        callback(null,{'uid':uid});
      });
    }
  });
}

Database.prototype.logThought = function(user,thought,ispublic,category,callback) {
  var _this = this;
  var timestamp = new Date().getTime();
  this.db.run('INSERT INTO Thought (uid,thought,public,category,created) VALUES (?,?,?,?,?)',[user.uid,thought,ispublic,category,timestamp],function(err) {
    if (err) {
      callback(err);
    } else {
      callback(null,_this.prepareThought({
        'rowid': this.lastID,
        'uid': user.uid,
        'thought': thought,
        'public': ispublic,
        'category': category,
        'created': timestamp
      }));
    }
  });
}

Database.prototype.getThought = function(id,callback) {
  var _this = this;
  this.db.all('SELECT rowid,uid,thought,public,category,created FROM Thought WHERE rowid=?',[id],function(err,rows) {
    if (rows && rows.length > 0) {
      callback(null,_this.prepareThought(rows[0]));
    } else {
      callback(err);
    }
  });
}

Database.prototype.getUserThoughts = function(user,callback) {
  var _this = this;
  this.db.all('SELECT rowid,uid,thought,public,category,created FROM Thought WHERE uid=? ORDER BY created DESC',[user.uid],function(err,rows) {
    if (rows && rows.length > 0) {
      callback(err,rows.map(_this.prepareThought));
    } else {
      callback(err);
    }
  });
}

Database.prototype.prepareThought = function(thought) {
  var date = new Date(thought.created);
  thought.created_formatted = months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() + ' @ ' + date.toLocaleTimeString();

  thought.thought_formatted = markdown.toHTML(thought.thought);

  return thought;
}

exports.Database = Database;
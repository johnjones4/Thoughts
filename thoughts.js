var Database = require('./storage').Database;
var config = require('./config.json');
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var TwitterStrategy = require('passport-twitter').Strategy;
var MemcachedStore = require('connect-memcached')(session);
var http = require('http');
var jade = require('jade');


var db = new Database();

var app = express();
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
app.use(cookieParser());
app.use(session({
  secret: config.express.session_key,
  resave: true,
  proxy: true,
  saveUninitialized: true,
  store: new MemcachedStore({
    hosts: config.express.memcached_hosts
  })
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new TwitterStrategy({
    consumerKey: config.twitter.key,
    consumerSecret: config.twitter.secret,
    callbackURL: config.twitter.callback_root + "/auth/twitter/callback"
  },
  function(token, tokenSecret, profile, done) {
    db.findOrCreateUser(profile.id, function(err, user) {
      if (err) {
        return done(err);
      }
      done(null, user);
    });
  })
);

passport.serializeUser(function(user, done) {
  done(null, user.uid);
});

passport.deserializeUser(function(id, done) {
  db.findOrCreateUser(id, function(err, user) {
    done(err, user);
  });
});

app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/callback', passport.authenticate('twitter',{
  successRedirect: '/',
  failureRedirect: '/'
}));

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.get('/', function(req,res) {
  if (req.user) {
    db.getUserThoughts(req.user,function(err,thoughts) {
      getQuote(function(quote) {
        res.render('thoughts',{
          'user': req.user,
          'quote': quote,
          'thoughts': thoughts || [],
          'ga': config.ga
        });
      });
    });
  } else {
    res.render('index',{});
  }
});

app.post('/thought', function(req,res) {
  if (req.user) {
    if (req.body && req.body.thought) {
      var ispublic = req.body['public'] && req.body['public'] == 'public' ? 1 : 0;
      var category = !req.body['category'] || req.body['category'] == '' ? 'default' : req.body['category'];
      var thought = req.body.thought.replace('\r\n','\n').replace('\n\r','\n').replace('\r','');
      db.logThought(req.user,thought,ispublic,category,function(err,thought) {
        if (thought) {
          getQuote(function(quote) {
            res.json({
              'thought': jade.renderFile(__dirname + '/views/thought.jade',{
                'thought': thought,
                'user': req.user
              }),
              'quote': quote,
            });
          });
        } else {
          console.log(err);
          res.send(500);
        }
      });
    }
  } else {
    res.send(403);
  }
});

app.all('/thought/:rowid', function(req,res) {
  handleThoughtReq(req,res,function(thought) {
    res.render('thought-page', {
      'thought': thought,
      'user': req.user,
      'ga': config.ga
    });
  });
});

app.get('/thought/:rowid/download', function(req,res) {
  handleThoughtReq(req,res,function(thought) {
    res.setHeader('Content-disposition', 'attachment; filename=thought_' + thought.rowid + '.md');
    res.setHeader('Content-type', 'text/x-markdown');
    res.send(thought.thought);
  })
});

app.get('/thought/:rowid/edit', function(req,res) {
  if (req.user) {
    db.getThought(req.params.rowid,function(err,thought) {
      if (thought.uid == req.user.uid) {
        res.render('thought-edit', {
          'quote': '',
          'thought': thought,
          'user': req.user,
          'ga': config.ga
        });
      } else { 
        res.send(403);
      }
    });
  }
});

app.post('/thought/:rowid/edit', function(req,res) {
  if (req.user) {
    db.getThought(req.params.rowid,function(err,thought) {
      if (thought.uid == req.user.uid) {
        thought['public'] = req.body['public'] && req.body['public'] == 'public' ? 1 : 0;
        thought.category = !req.body['category'] || req.body['category'] == '' ? 'default' : req.body['category'];
        thought.thought = req.body.thought.replace('\r\n','\n').replace('\n\r','\n').replace('\r','');
        db.updateThought(thought,function(err,thought) {
          res.redirect(307,'/thought/'+thought.rowid);
        });
      } else { 
        res.send(403);
      }
    });
  }
});

app.get('/thought/:rowid/access', function(req,res) {
  if (req.user) {
    db.getThought(req.params.rowid,function(err,thought) {
      if (thought.uid == req.user.uid) {
        thought['public'] = !thought['public'];
        db.updateThought(thought,function(err,thought) {
          if (err) {
            console.log(err);
            res.send(500);
          } else {
            res.redirect(307,'/thought/'+thought.rowid);
          }
        })
      } else { 
        res.send(403);
      }
    });
  }
});

db.connect(function() {
  app.listen(config.express.port,function() {
    console.log('Server running.');
  });
});

function handleThoughtReq(req,res,callback) {
  db.getThought(req.params.rowid,function(err,thought) {
    if (err) {
      console.log(err);
      res.send(500);
    } else if (thought && ((req.user && thought.uid == req.user.uid) || thought['public'])) {
      callback(thought);
    } else if (thought && !thought['public']) {
      res.send(403);
    } else {
      res.send(404);
    }
  });
}

function getQuote(callback) {
  http.request({
    'host': 'api.forismatic.com',
    'path': '/api/1.0/?method=getQuote&format=json&lang=en'
  },function(response) {
    var str = '';
    response.on('data', function (chunk) {
      str += chunk;
    });
    response.on('end', function () {
      try {
        var quote = JSON.parse(str);
        callback(quote.quoteText);
      } catch(e) {
        callback('');
      }
    });
  }).end();
}
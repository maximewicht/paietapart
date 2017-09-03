var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressSession = require('express-session');
var io =  require('socket.io')();
var app = express();

app.io = io;
var router = require('./routes/index')(io);

//set view engines
//app.engine('hbs', hbs({extname:'hbs', defaultLayout: 'layout', layoutDir:__dirname + '/views/layouts/'}));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressSession({secret: 'max', saveUninitialized:false, resave:false}));

app.use('/', router);

app.use(function(req,res,next){
    var err = new Error('Not found');
    err.status = 404;
    next(err);
});

module.exports = app;
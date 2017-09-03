var path = require("path");
var mime = require("mime");
var ocr = require("../other/ocr.js");
var upload = require('../other/upload.js');
var sessions = require("../other/splitsession.js");

module.exports = function(io) {

    var express = require('express');
    var router = express.Router();

    //GET home page
    router.get('/', function(req,res,next){
        res.render('index', {title: 'Paie ta part',sessions:sessions.sessionsList});
    });

    router.post('/upload', upload.single('bill'), function(req,res,next) {
        console.log(req.file);
        if (!req.file) {
            res.redirect('/');
            return;
        }
        req.session['imgpath'] = req.file.path;
        req.session['ext'] = mime.extension(req.file.mimetype);
        //send croping page with uploaded picture, get img width and height
        ocr.prepare(req.file.path, function(){
            res.render('crop', {title: 'Crop !!', filepath: path.join('uploads', req.file.filename)});
        });
    });

    router.post('/crop/okay', function(req,res,next) {
        console.log('/crop/okay');
        console.log(req.body);
        var path = req.session['imgpath'];
        var ext = req.session['ext'] ;
        var x = Math.round(req.body.x);
        var y = Math.round(req.body.y);
        var h = Math.round(req.body.h);
        var w = Math.round(req.body.w);
        var priceTop = false;
        if (req.body.pricetop) {
            priceTop = true;
        }
        var options = {imgUrl:path,ext:ext,x:x,y:y,w:w,h:h,top:priceTop};
        console.log(options);
        ocr.doJob(options, function(result) {
            result.sort(function(a,b){
                if (a.id === b.id) return 0;
                if (a.id === 'top') return -1;
                if (a.id === 'bottom') return 1;
                if (a.id < b.id) return -1;
                if (a.id > b.id) return 1;
                return 0;
            });
            req.session['result'] = result;
            res.render('verify', {items: result});
        });
    });

    router.post('/newsession', function(req,res,next) {
        var items = req.session['result'];
        if (!items) {
            res.render(404,'index', {title: 'Error'});
            return;
        }
        items.forEach(function(item) {
            if (!item.topbottom) {
                item.price = req.body['item-' + item.id];
            }
        });

        sessions.addNewSession(items);
        res.render('index', {title: 'Success', sessions:sessions.sessionsList});

    });

    router.get('/join/:id', function(req,res,next){
        var sid = req.params.id;
        if (!sessions.sessionExists(sid))
            res.render('index');
        else
            res.render('play', {sessionId: sid, items:sessions.getSessionItems(sid)});
    });

    io.on('connection', function(socket) {
        console.log('connection');
        var clientId;
        var sessionId;
        socket.on('newuser', function(data) {
            if (!data.pseudo) {
                res.redirect('/');
                return;
            }
            console.log('newuser');
            console.log(data);
            if(!sessions.sessionExists(data.sessionId))
                res.redirect('/');
            socket.join(data.sessionId);
            sessionId = data.sessionId;
            clientId = data.pseudo;
            sendUpdate(sessionId);
        });

        socket.on('toggle', function(data) {
            if (!clientId || sessionId != data.sessionId || isNaN(data.itemId)) {
                res.redirect('/');
                return; 
            }
            //console.log(data);

            sessions.toggleItemForUser(sessionId, clientId, data.itemId);
            sendUpdate(sessionId);
        });

        socket.on('guest', function(data) {
            if (!clientId || sessionId != data.sessionId) {
                res.redirect('/');
                return; 
            }
            //console.log(data);
            sessions.changeGuest(data.sessionId, clientId, data.guest);
            sendUpdate(sessionId);
        });

        socket.on('disconnect', function(){
            if (!clientId) {
                res.redirect('/');
                return; 
            }
            //console.log('disconnect');
            sessions.disconnectUser(sessionId, clientId);
            io.to(sessionId).emit('userDisconnected', {user:clientId});
            sendUpdate(sessionId);
        });

    });

    function sendUpdate(sessionId) {
        var sessionState = sessions.getSessionState(sessionId);
        var userstate = sessions.getUsersState(sessionId);
        io.to(sessionId).emit('update', {users:userstate, session:sessionState});
    }


    return router;
}


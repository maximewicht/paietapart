var multer = require('multer');
var mime = require('mime');
var path = require('path');

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, path.join(__dirname, '../','public/uploads'));
    },
    filename: function (req, file, callback) {
        callback(null, file.fieldname + '-' + Date.now() + '.' + mime.extension(file.mimetype));
    }
});

var upload = multer({ storage : storage });

module.exports = upload;
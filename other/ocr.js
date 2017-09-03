"use strict";
var process = require('child_process');
var gm = require('gm');
require('gm-base64');
var fs = require('fs');
var rext = require('replace-ext');


//options = {imgUrl:url,ext:string,x:int,y:int,w:int,h:int,top:bool}
exports.doJob = function(options, callback) {
	writeUzn(options, function(err) {
		var cmd = 'tesseract ' + options.imgUrl + ' stdout -psm 4 makebox cs_paietapart';
		console.log(cmd);
		process.exec(cmd, function(err, stdout, stderr) {
			//deleteUzn(options);
			if (err) {
				console.log(err);
			}
			else {
				getSize(options.imgUrl, function(wh){
					extractItems(options, wh, stdout, callback);
				});
			}
		});
	});
};

var getSize = function(filepath, callback) {
	gm(filepath).size(function(err, value) {
		console.log(value);
		callback(value);
	});
};


var prepare = function(filepath, callback) {
	gm(filepath).autoOrient().whiteThreshold('40%').write(filepath, function(err) {
		callback();
	});
};


function createBillItem(idx, wh, box, options, onfinish) {
	console.log('create bill item idx '  + idx);
	var margin = wh.height / 100;
	var w = box.x2 - box.x1;
	var dx = box.x1;
	var h = box.y2 - box.y1;
	var dy = wh.height - box.y2;
	console.log('w: ' + w + ' h: ' + h + ' dx:' + dx + ' dy:' + dy + ' value:' + box.value);
	var itemId = idx;
	var price = 0.0;
	var topbottom = false;
	if (box.value === 'top' || box.value == 'bottom') {
		itemId = box.value;
		topbottom = true;
	}
	else {
		price = parseFloat(box.value);
		price = (Math.ceil(price*20)/20).toFixed(2); //round to closest 0.05
	}
	gm(options.imgUrl).crop(w, h, dx, dy).toBase64(options.ext, function(err, base64){
		var imgSrc = 'data:image/' + options.ext + ';base64,' + base64;
		var item = {id:itemId, price:price, src:imgSrc, topbottom:topbottom};
		onfinish(item, idx);
	});
}

function extractItems(options, wh, stdout, onfinish) {
	console.log(stdout);
	var boxes = parseOCRLines(stdout);
	var tolerance = wh.height / 100;
	boxes = mergeDigitsBoxes(boxes, tolerance);
	console.log('-Digits boxes-');
	var clean = [];
	boxes.forEach(function(box){
		if (box.value.indexOf(".") == -1) {
			box.value = box.value.replace("potentialDot",".");
		}
		box.value = box.value.replace("potentialDot","");
		if (!isNaN(box.value) && (box.y2 > box.y1)) {
			clean.push(box);
		}
	});
	console.log(clean);
	expandToLabels(clean, wh.width, wh.height, options);
	console.log('-Expanded to labels-');
	console.log(clean);
	var items = [];
	var i = 0;
	clean.forEach(function(box) {
		createBillItem(i, wh, box, options, function(item, idx){
			items.splice(idx,0,item);	
			if (idx >= clean.length - 1) { //last one
				onfinish(items);
			}
		});
		i++;
	});
}

function parseOCRLines(stdout){
	var lines = stdout.split(/\r?\n/);
	var boxes = [];
	lines.forEach(function(line) {
		if (line.length > 0) {
			var box = parseOCRLine(line);
			if (box) {
				boxes.push(box);
			}
		}
	});
	return boxes;
}

function parseOCRLine(line) {
	var parts = line.split(" ");
	var box = {
		value: parts[0].replace(",",".").replace("~","potentialDot"),
		x1: parseInt(parts[1]),
		y1: parseInt(parts[2]),
		x2: parseInt(parts[3]),
		y2: parseInt(parts[4]),
	};
	if (box.value)
		return box;
	return null;
}

//merge digits on the same line
function mergeDigitsBoxes(boxes,tolerance) {
	var lineBox = boxes[0];
	var linesBoxes = [];
	var i = 1;
	for (;i<boxes.length;i++) {
		var box = boxes[i];
		var delta = Math.abs(lineBox.y1 - box.y1);
		if (delta <= tolerance) { //same line
			lineBox.x2 = box.x2;
			lineBox.y2 = Math.max(lineBox.y2, box.y2);
			lineBox.y1 = Math.max(lineBox.y1, box.y1);
			lineBox.value += box.value;
			if ((i+1) >= boxes.length) {
				linesBoxes.push(lineBox);
			}
		}
		else {
			linesBoxes.push(lineBox);
			lineBox = box;
		}
	}
	linesBoxes.sort(function(box1, box2) {
		return box2.y1 - box1.y1;
	});
	return linesBoxes;
}

function expandToLabels(boxes, billWidth, billHeight, options) {
	var previous = null;
	var i = 0;
	var margin = (billHeight / 20) / boxes.length;
	for (;i<boxes.length;i++) {
		var itemBox = boxes[i];
		if (previous) {
			if (options.top) {
				itemBox.y2 = itemBox.y2;
				previous.y1 = itemBox.y2; //expand down the previous box to the top of the current box
			}
			else {
				previous.y1 = previous.y1 - margin;
				itemBox.y2 = previous.y1; //expand up the current box to the bottom of the last box
			}
		}
		itemBox.x1 = 0;
		itemBox.x2 = billWidth;
		previous = itemBox;
	}
	var topBox = {value:'top', x1:0, y1:billHeight-options.y, x2:billWidth, y2:billHeight};
	var bottomBox = {value:'bottom', x1:0, y1:0, x2:billWidth, y2:billHeight - (options.y + options.h)};
	if ((topBox.y2 - topBox.y1) > 0)
		boxes.unshift(topBox);
	if ((bottomBox.y2 - bottomBox.y1) > 0)
		boxes.push(bottomBox);
}

function writeUzn(options, onfinish) {
	var content = '';
	content += options.x + ' ';
	content += options.y + ' ';
	content += options.w + ' ';
	content += options.h + ' ';
	content += 'Text/Latin';
	fs.writeFile(uznFilename(options.imgUrl, options.ext), content, onfinish);
}

function deleteUzn(options) {
	fs.unlink(uznFilename(options.imgUrl, options.ext), function(){});
}

function uznFilename(imgUrl, imgExt) {
	return rext(imgUrl, '.uzn');
}

exports.getSize = getSize;
exports.prepare = prepare;
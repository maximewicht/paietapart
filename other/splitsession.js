var uuid = require('node-uuid');
var dateFormat = require('dateformat');

var sessions = [];

function SplitSession(items, sessionId) {
	this.sessionId = sessionId;
	this.timestamp = dateFormat();
	this.items = items;
	this.state = [];
	this.guests = [];
}

SplitSession.prototype.initState = function() {
	//console.log(this.state);
	var temp = [];
	this.items.forEach(function(item) {
		if (!item.topbottom) {
			var stateHolder = {
				id:item.id,
				price:item.price, 
				users: [], 
				userprice:0.0
			};
			temp.push(stateHolder);
		}
	});
	this.state = temp;
	//console.log(this.state);
};


SplitSession.prototype.removeUser = function(user) {
	this.handleChangeGuest(user, false);
	this.state.forEach(function(item) {
		var userIdx = item.users.indexOf(user);
		if (userIdx > -1) {
			item.users.splice(userIdx, 1);
			updatePricePerUser(item);
		}
	});
	//console.log(this.state);
};


SplitSession.prototype.handleToggleItem = function(user, itemId) {
	this.state.forEach(function(crtItem) {
		if (crtItem.id == itemId) {
			item = crtItem;
		}
	})
	if (!item)
		return;
	var userIdx = item.users.indexOf(user);
	if (userIdx == -1) {
		item.users.push(user);
	}
	else {
		item.users.splice(userIdx, 1);
	}
	updatePricePerUser(item);
	//console.log(this.state);
};

SplitSession.prototype.handleChangeGuest = function(user, guest) {
	var userIdx = this.guests.indexOf(user);
	if (userIdx == -1) {
		//user is a new guest
		if (guest) {
			this.guests.push(user);
		}
	}
	else {
		//remove the user as guest
		if (!guest) {
			this.guests.splice(userIdx, 1);
		}
	}
};

SplitSession.prototype.isGuest = function(user) {
	return this.guests.indexOf(user) > -1;
};

/* interface */
exports.getUsersState = function(sid) {
	var session = sessionById(sid);
	if (session) {
		var result = {};
		session.state.forEach(function(item) {
			item.users.forEach(function(user) {
				var userState = result[user];
				if (!userState) {
					var userIsGuest = session.isGuest(user);
					userState = {pseudo:user, userprice:item.userprice, guest:userIsGuest};
					result[user] = userState;
				} 
				else {
					userState.userprice += item.userprice;
				}
			});
		});
		var nbNonGuest = 0;
		var guestsPart = 0.0;
		for (var user in result) {
			var userState = result[user];
			if (userState.guest) {
				guestsPart += userState.userprice;
			}
			else {
				nbNonGuest++;
			}
		}
		var paidPrice = 0.0;
		guestsPart = guestsPart / nbNonGuest;
		for (var user in result) {
			var userState = result[user];
			if (!userState.guest) {
				userState.userprice += guestsPart;
				paidPrice += userState.userprice;
			}
		}
		result['paidPrice'] = paidPrice;
		return result;
	}
	return null;
};

exports.getSessionState = function(sid) {
	var session = sessionById(sid);
	if (session) {
		return session.state;
	}
	return null;
};

exports.getSessionItems = function(sid) {
	var session = sessionById(sid);
	if (session)
		return session.items;
	return null;
};

exports.toggleItemForUser = function(sid, user, itemId) {
	var session = sessionById(sid);
	if (session)
		session.handleToggleItem(user, itemId);
};

exports.changeGuest = function(sid, user, guest) {
	var session = sessionById(sid);
	if (session)
		session.handleChangeGuest(user, guest);
};

exports.disconnectUser = function(sid, user) {
	var session = sessionById(sid);
	if (session)
		session.removeUser(user);
};

/* utils */

function sessionById(sid) {
	var result = null;
	sessions.forEach(function(session) {
		if (session.sessionId == sid) {
			result = session;
		}
	});
	return result;
}

function updatePricePerUser(item){
	if (item.users.length > 0)
		item.userprice = item.price / item.users.length;
	else
		item.userprice = 0;
}

exports.addNewSession = function(items) {
	var sid = uuid.v4().replace(/-/g, "");
	var session = new SplitSession(items, sid);
	session.initState();
	sessions.push(session); 
};

exports.removeSession = function(thesession) {
	var index = sessions.indexOf(thesession);
	if (index > -1) {
		array.splice(index, 1);
	}
};

exports.sessionExists = function(sid) {
	if (sessionById(sid))
		return true;
	return false;
}


exports.sessionsList = function() {
	var result = sessions.slice();
	return result;
};

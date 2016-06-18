if (!process.env.ZWV_DEVICE || process.env.ZWV_DEVICE === '') {
    throw "configure environement variable ZWV_DEVICE";
}
var COMMAND_CLASS_SWITCH_MULTILEVEL = 38;
var ADD_WAITING_TIME = 1000 * 60 * 3;
var RESET_WAITING_TIME = 1000 * 60 * 5;

var express = require('express');
var tools = require('./tools.js');
var ZWave = require('openzwave-shared');

var app = express();
var zwave = new ZWave({Logging: false});
var nodes = {};
var adding = false;
var reseting = false;

zwave.connect(process.env.ZWV_DEVICE);
// driver handlers
// ===============
zwave.on('driver ready', function(homeid) {
    console.log('scanning homeid=0x%s...', homeid.toString(16));
});

zwave.on('driver failed', function() {
    console.log('failed to start driver');
    zwave.disconnect();
    process.exit();
});


// just initialize your busines rule after this handler was executed
zwave.on('scan complete', function() {
	app.listen(3000, function () {
	  tools.logTitle('zwave REST listening on port 3000!');
	});
});


// node events
// ===========
zwave.on('node added', function(nodeid) {
    tools.log('node added', {nodeid:nodeid});
    nodes[nodeid] = {
        manufacturer: '',
        manufacturerid: '',
        product: '',
        producttype: '',
        productid: '',
        type: '',
        name: '',
        loc: '',
        classes: {},
        ready: false,
    };
});

zwave.on('node ready', function(nodeid, nodeinfo) {
    tools.log('node ready', {nodeId: nodeid}, nodeinfo);
    
    node = nodes[nodeid];

    // update node
    node.id = nodeid;
    node.manufacturer = nodeinfo.manufacturer;
    node.manufacturerid = nodeinfo.manufacturerid;
    node.product = nodeinfo.product;
    node.producttype = nodeinfo.producttype;
    node.productid = nodeinfo.productid;
    node.type = nodeinfo.type;
    node.name = nodeinfo.name;
    node.loc = nodeinfo.loc;
    node.ready = true;

    nodes[nodeid] = node;

    for (var commandclass in node.classes) {
        if (commandclass == COMMAND_CLASS_SWITCH_MULTILEVEL) {
        	node.withRange = true;
            zwave.enablePoll(nodeid, commandclass);
            break;
        } else {
        	node.withRange = false;
        }
    }
});

zwave.on('value added', function(nodeid, commandclass, value){
    tools.log(
        'value added',
        {nodeId: nodeid},
        {command: commandclass},
        {value: value});

    if (!nodes[nodeid].classes[commandclass]) {
        nodes[nodeid].classes[commandclass] = {};
    }
    nodes[nodeid].classes[commandclass][value.index] = value;
});

zwave.on('value changed', function(nodeid, commandclass, value){
    tools.log(
        'value changed',
        {nodeId: nodeid},
        {command: commandclass},
        {value: value});

    nodes[nodeid].classes[commandclass][value.index] = value;
});

zwave.on('value refreshed', function(nodeid, commandclass, value){
    tools.log(
        'value refreshed',
        {nodeId: nodeid},
        {command: commandclass},
        {valueid: value});
});

zwave.on('value removed', function(nodeid, commandclass, index) {
    if (nodes[nodeid].classes[commandclass] &&
        nodes[nodeid].classes[commandclass][index]) {

        delete nodes[nodeid].classes[commandclass][index];
    }
});


zwave.on('notification', function(nodeid, notif) {
    tools.logTitle('notification');
    switch (notif) {
    case 0:
        console.log('node%d: message complete', nodeid);
        break;
    case 1:
        console.log('node%d: timeout', nodeid);
        break;
    case 2:
        console.log('node%d: nop', nodeid);
        break;
    case 3:
        console.log('node%d: node awake', nodeid);
        break;
    case 4:
        console.log('node%d: node sleep', nodeid);
        break;
    case 5:
        console.log('node%d: node dead', nodeid);
        break;
    case 6:
        console.log('node%d: node alive', nodeid);
        break;
    default:
        console.log('node%d: %d', nodeid, notif);
        break;
    }
    tools.logBottom();
});

app.get('/reset', function (req, res) {
	if (!reseting) {
		try {
			setTimeout(function(){reseting = false;}, RESET_WAITING_TIME);
			reseting = true;
			zwave.hardReset();	
		} catch (err) {
			console.log(err);
		}
	}
	
	res.send("reseting....");
});

app.get('/nodes', function (req, res) {
	res.send(nodes);
});

app.get('/nodes/length', function (req, res) {
	res.send({length:nodes.length});
});

app.get('/nodes/add', function (req, res) {
	if (!adding) {
		setTimeout(function(){adding = false;}, ADD_WAITING_TIME);
		adding = true;
		zwave.addNode(false);
	}
	res.send("adding...");
});

process.on('SIGINT', function() {
    zwave.disconnect(process.env.ZWV_DEVICE);
    process.exit();
});
"use strict";

var fs = require('fs')
var path = require('path')

var file_matcher = /\.js$/;

var _ = require('underscorem')

var rimraf = require('rimraf')
var mh = require('matterhorn');

var start = Date.now()

var minnow = require('./../client/client')
var minnowWebsocket = require('./../http/js/minnow_websocket')

var oldMakeClient = minnow.makeClient
var oldMakeServer = minnow.makeServer

var portCounter = 8000

function serviceSecuritySettings(viewName, cb){
	cb(true)//open everything up
}
function authenticate(req,res,next){next()}
function authenticateByToken(token, cb){cb(undefined, 'TheOnlyUser');}

var hostsByPort = {}	
var closedHosts = {}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require('./runtests_abstract').run(
	function(port, host, cb){
		//oldMakeClient(port, host, cb)
		if(closedHosts[port]){
			_.errout('tried to connect to ended server: ' + port)
		}
		if(hostsByPort[port] === undefined){
			//console.log(JSON.stringify([hostsByPort,closedHosts]))
			_.errout('tried to connect to unmade or unloaded server at port: ' + port)
		}
		minnowWebsocket.setup(hostsByPort[port],'testapp',function(db){
			//console.log('got db')
			cb(db)
		})
	},
	function(config, cb){
		/*oldMakeServer(config, function(server){
			cb(server)
		})*/
		var mhPort = portCounter
		++portCounter;
		var matterhornConfig = {
			name: 'testing',
			host: 'localhost',
			port: mhPort*2,
			securePort: mhPort
		};
		//console.log('minnow port: ' + config.port)
		var host = 'https://localhost:'+mhPort
		hostsByPort[config.port] = host

		mh.load(matterhornConfig, function(local, secureLocal, doneCb){
			oldMakeServer(config, function(sh){
				_.assertObject(sh)
				//servers.push(sh)
				sh.port = config.port
				oldMakeClient(config.port, function(c){
					//console.log('setting up mh service: ' + matterhornConfig.port)
					//name, local, secureLocal, identifier, authenticateByToken, viewSecuritySettings, syncHandleCreationListener
					c.setupService('testapp', '', local, secureLocal, authenticate, authenticateByToken, serviceSecuritySettings, {});
					//name, urlPrefix, local, secureLocal, identifier, authenticateByToken, viewSecuritySettings, listeners){
					doneCb()							
					setTimeout(function(){
						cb({
							close: function(cb){
								//servers.splice(servers.indexOf(sh), 1)
								sh.close(cb)
							}
						})
					},100)
					
				})
			})
		})
	}
)

/*
var old = console.log
console.log = function(msg){
	if(msg.indexOf('many:') === 0){
		console.log(new Error().stack)
		throw new Error()
	}
	old(msg)
}*/

/*
var includedTestDir
var includedTest
if(process.argv.length > 2){
	includedTestDir = process.argv[2]
	includedTest = process.argv[3]
	//console.log('including only dirs: ' + JSON.stringify(includedTestDirs))
}

var log = console.log
//console.log = function(){}

function each(obj, cb){
	var keys = Object.keys(obj);
	keys.forEach(function(key){
		cb(obj[key], key);
	})
}

var files = fs.readdirSync(__dirname);
var dirs = []
var cdl = _.latch(files.length, cont)
files.forEach(function(file) {
	var fileOrDir = __dirname + '/' + file
	fs.stat(fileOrDir, function(err, s){
		if(err) throw err
		
		
		if(s.isDirectory()){
			//log('is directory: ' + fileOrDir)
			if(!includedTestDir || includedTestDir === file){
				dirs.push(fileOrDir)
			}
		}
		cdl()
	})
})


var tests = []
function cont(){
	console.log('running tests in dirs: ' + JSON.stringify(dirs))
	
	var cdl = _.latch(dirs.length, function(){
		//moreCont(function(){
			//moreCont(function(){
				moreCont(function(report){
					setTimeout(function(){
						report()
						process.exit()
					},500)
				})
			//})
		//})
	})
	
	dirs.forEach(function(dir){
		fs.readdir(dir, function(err, files){
			if(err) throw err
			
			//log('got dir files: ' + dir + ' ' + JSON.stringify(files))
			
			files.forEach(function(file){
				if(file.match(file_matcher)){
					//log('requiring: ' + file)
					var t = require(dir+'/'+file)
					each(t, function(test, name){
						//log('got test')
						if(includedTest && includedTest !== name) return
						
						tests.push({name: name, test: test, dir: dir, dirName: path.basename(dir)})
					})
				}
			})
			cdl()
		})
	})
}

var portCounter = 2000

function moreCont(doneCb){	

	var passedCount = 0;
	var failedCount = 0;
	
	var failedList = []
	//var dieCdl = _.latch(tests.length, function(){
	function report(){
		console.log('all tests finished: ' + passedCount + '/' + (failedCount+passedCount));
		console.log('took ' + (Date.now()-start)+'ms.')
		if(failedList.length > 0){
			console.log('failed: ')
			failedList.forEach(function(f){
				console.log(f[0] + ' failed')
				console.log(f[1])
			})
		}
	}
	function die(){
		
		doneCb(report)
	}
	//})
	
	var inProgress = []
	
	process.on('uncaughtException', function(e){
		console.log('got uncaught exception')
		//throw new Error(e)
		console.log(e)
		console.log(e.stack)
		currentFail(e)
	})

	var hostsByPort = {}	
	var closedHosts = {}
	
	var currentTest;
	var currentFail
	function runNextTest(){
		if(tests.length === 0){
			die()
		}
		var t = tests.shift()
		if(!t) return
		
		currentTest = t
		
		
		//runTest(t, function(){

		var nt = {
			dir: t.dir,//path.dirname(t.dir)+'_xhr',
			dirName: t.dirName+'_websocket',
			name: t.name+'_websocket',
			test: t.test
		}
		var oldMakeClient = minnow.makeClient
		var oldMakeServer = minnow.makeServer
		
		function serviceSecuritySettings(viewName, cb){
			cb(true)//open everything up
		}
		function authenticate(req,res,next){next()}
		function authenticateByToken(token, cb){cb(undefined, 'TheOnlyUser');}

				
		minnow.makeClient = function(port, cb){
			if(closedHosts[port]){
				_.errout('tried to connect to ended server: ' + port)
			}
			if(hostsByPort[port] === undefined){
				//console.log(JSON.stringify([hostsByPort,closedHosts]))
				_.errout('tried to connect to unmade or unloaded server at port: ' + port)
			}
			minnowWebsocket.setup(hostsByPort[port],'testapp',function(db){
				//console.log('got db')
				cb(db)
			})
		}
		var servers = []
		minnow.makeServer = function(config, cb){
			var mhPort = portCounter
			++portCounter;
			var matterhornConfig = {
				name: 'nstudy2',
				host: 'localhost',
				port: mhPort
			};
			//console.log('minnow port: ' + config.port)
			var host = 'http://localhost:'+mhPort
			hostsByPort[config.port] = host

			mh.load(matterhornConfig, function(local, secureLocal, doneCb){
				oldMakeServer(config, function(sh){
					_.assertObject(sh)
					servers.push(sh)
					sh.port = config.port
					oldMakeClient(config.port, function(c){
						//console.log('setting up mh service: ' + matterhornConfig.port)
						c.setupService('testapp', local, authenticate, authenticateByToken, serviceSecuritySettings);
						doneCb()							
						setTimeout(function(){
							cb({
								close: function(cb){
									servers.splice(servers.indexOf(sh), 1)
									sh.close(cb)
								}
							})
						},100)
						
					})
				})
			})
		}
		//console.log('running test: ' + JSON.stringify(nt))
		runTest(nt, function(){
			var cdl = _.latch(servers.length, function(){
				minnow.makeClient = oldMakeClient
				minnow.makeServer = oldMakeServer
				runNextTest()
			})
			servers.forEach(function(sh){
				closedHosts[sh.port] = true
				try{
					sh.close(cdl)
				}catch(e){
					console.log(e)
					cdl()
				}
			})
		})			
	}
	runNextTest()
	
	function runTest(t, cb){
		var port = portCounter
		++portCounter;
		inProgress.push(t)
		var testDir = t.dir + '/' + t.name + '_test'

		var donePassed
		function done(){
			log('test passed: ' + t.dirName + '.' + t.name)
			donePassed = true
			++passedCount
			finish()
		}
		function fail(e){
			if(donePassed) return
			log('test failed: ' + t.dirName + '.' + t.name)
			++failedCount
			//console.log(e)
			failedList.push([t.dirName+'.'+t.name, e.stack])
			log(e.stack)
			//process.exit(0)
			finish()
		}
		currentFail = fail
		done.fail = function(ee){
			if(_.isString(ee)) ee = new Error(ee)
			fail(ee)
		}
		
		var timeoutHandle = setTimeout(function(){
			fail(new Error('test timed out'))
		}, 6000)
		
		function finish(){
			clearTimeout(timeoutHandle)
			var ii = inProgress.indexOf(t)
			inProgress.splice(ii, 1)

			rimraf(testDir, function(err){
				if(err){
					rimraf(testDir, function(err){
						if(err) throw err;
					})
				}
				cb()
			})
		}
		
		function doTest(){
			try{
				var config = {schemaDir: t.dir, dataDir: testDir, port: port}
				//console.log('calling: ' + port)
				t.test(config, done)
			}catch(e){
				fail(e)
			}
		}
		function makeDir(){
			//log('making dir: ' + testDir)
			fs.mkdir(testDir, function(err){
				if(err){
					if(err.code === 'EEXIST'){
						//log('making - with rimraf')
						rimraf(testDir, function(err){
							if(err) throw err
							makeDir()
						})
						return;
					}else{
						throw new Error('mkdir error: ' + err);
					}
				}
			
				doTest()
			})
		}
		makeDir()
	}
}*/

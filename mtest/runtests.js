
var fs = require('fs')
var path = require('path')

var file_matcher = /\.js$/;

var _ = require('underscorem')

var rimraf = require('rimraf')
var mh = require('matterhorn');

var start = Date.now()

var minnow = require('./../client/client')
var minnowXhr = require('./../http/js/minnow_xhr')

/*
var count = 0
var old = console.log
console.log = function(msg){
	msg = ''+msg
	if(msg.indexOf('Error') === -1 && msg.indexOf('test ') === -1 && msg.indexOf('WARNING') === -1 && count > 0){
		console.log(new Error().stack)
		//throw new Error()
	}
	++count
	old(msg)
}*/


var oldMakeClient = minnow.makeClient
var oldMakeServer = minnow.makeServer

var usingSameClient = false

var currentClientList
var currentServerList
minnow.makeClient = function(port, host, cb){
	if(arguments.length === 2){
		cb = host
		host = undefined
	}
	
	if(usingSameClient && currentClientList.length === 1){
		cb(currentClientList[0])
		return
	}
	
	oldMakeClient(port, host, function(client){
		currentClientList.push(client)
		cb(client)
	})
}
minnow.makeServer = function(config, cb){
	oldMakeServer(config, function(server){
		currentClientList = []//TODO cleanup?
		currentServerList.push(server)
		cb(server)
	})
}

var includedTestDir
var includedTest
var useSameClient
if(process.argv.length > 2){
	includedTestDir = process.argv[2]
	includedTest = process.argv[3]
	useSameClient = process.argv[4]
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
		console.log('Error: got uncaught exception')
		//throw new Error(e)
		console.log(e)
		console.log(e.stack)
		currentFail(e)
	})
	
	var currentTest;
	var currentFail
	function runNextTest(){
		if(tests.length === 0){
			die()
		}
		var t = tests.shift()
		if(!t) return
		
		currentTest = t

		if(t.test.forbidSameClient){
			if(useSameClient === 'yes'){
				console.log('cannot run same client test: forbidden by test')
				runNextTest()
			}else{
				runTest(t, false, runNextTest)
			}
		}else{
			if(useSameClient === 'yes'){
				runTest(t, true, runNextTest)
			}else{	
				runTest(t, false, function(){
					if(useSameClient === 'no'){
						runNextTest()
					}else{
						runTest(t, true, runNextTest)
					}
				})
			}
		}
	}
	runNextTest()
	
	function runTest(t, useSameClient, cb){
		_.assertLength(arguments, 3)
		
		var port = portCounter
		++portCounter;
		inProgress.push(t)
		var testDir = t.dir + '/' + t.name + '_test_'+(useSameClient?'yes':'no')
		
		usingSameClient = useSameClient

		var myServerList = currentServerList = []
		var myClientList = currentClientList = []

		var donePassed
		function done(){
			log('test passed: ' + t.dirName + '.' + t.name+'[sameClient: ' + (useSameClient?'yes':'no') + ']')
			donePassed = true
			++passedCount
			finish()
		}
		function fail(e){
			e = e || new Error('fail called, error unknown')
			if(donePassed) return
			log('test failed[sameClient: ' + (useSameClient?'yes':'no') + ']: ' + t.dirName + '.' + t.name)
			++failedCount
			//console.log(e)
			failedList.push([t.dirName+'.'+t.name+'[sameClient: ' + (useSameClient?'yes':'no') + ']', e.stack])
			log(e.stack)
			//process.exit(0)
			finish()
		}
		currentFail = fail
		done.fail = function(ee){
			if(_.isString(ee)) ee = new Error(ee)
			fail(ee)
		}
		
		/*var timeoutHandle = setTimeout(function(){
			fail(new Error('test timed out'))
		}, 4000)*/
		
		var timeoutHandle
		
		function finish(){
			setTimeout(function(){
				myClientList.forEach(function(s){
					s.close(function(){})
				})
				myServerList.forEach(function(s){
					try{
						s.close(function(){})
					}catch(e){
					}
				})
			},0)
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
				//console.log('calling')
				var realDelay = t.test(config, done)
				realDelay = realDelay || 4000
				
				timeoutHandle = setTimeout(function(){
					fail(new Error('test timed out'))
				}, realDelay)
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
}

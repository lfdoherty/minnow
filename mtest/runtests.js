
var fs = require('fs')
var path = require('path')

var file_matcher = /\.js$/;

var _ = require('underscorem')

var rimraf = require('rimraf')
var mh = require('matterhorn');

var start = Date.now()

var minnow = require('./../client/client')
var minnowXhr = require('./../http/js/minnow_xhr')

require('./../http/js/api/topobject').prototype.errorOnWarn = true
/*
try{
var agent = require('webkit-devtools-agent');
}catch(e){
	//throw e
	console.log(e)
}*/
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
}
*/


var oldMakeClient = minnow.makeClient
var oldMakeServer = minnow.makeServer

require('./runtests_abstract').run(
	function(port, host, cb){
		oldMakeClient(port, host, cb)
	},
	function(config, cb){
		oldMakeServer(config, function(server){
			cb(server)
		})
	}
)

/*
var usingSameClient = false
var usingOptimizations = false

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
	config.disableOptimizations = !usingOptimizations
	oldMakeServer(config, function(server){
		currentClientList = []//TODO cleanup?
		currentServerList.push(server)
		cb(server)
	})
}

var includedTestDir
var includedTest
var useSameClient
var useOptimizations
if(process.argv.length > 2){
	includedTestDir = process.argv[2]
	includedTest = process.argv[3]
	useSameClient = process.argv[4]
	useOptimizations = process.argv[5]
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
					},400)
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
						//log('got test in ' + dir)
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

var heapdump = require('heapdump');
//heapdump.writeSnapshot();//just checking

var currentFail
process.on('uncaughtException', function(e){
	console.log('Error: got uncaught exception')
	//throw new Error(e)
	console.log(e)
	console.log(e.stack)
	currentFail(e)
})

function moreCont(doneCb){	

	var passedCount = 0;
	var failedCount = 0;
	
	var failedList = []
	//var dieCdl = _.latch(tests.length, function(){
	function report(){
		console.log('all tests finished: ' + passedCount + '/' + (failedCount+passedCount));
		
		//if(global.gc) global.gc()
		//heapdump.writeSnapshot();
		
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
	

	var currentTest;
	//var currentFail
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
				runTest(t, false, useOptimizations, runNextTest)
			}
		}else{
			if(useSameClient === 'yes'){
				runTest(t, true, useOptimizations, runNextTest)
			}else{	
				runTest(t, false, useOptimizations, function(){
					if(useSameClient === 'no'){
						runNextTest()
					}else{
						runTest(t, true, useOptimizations, runNextTest)
					}
				})
			}
		}
	}
	runNextTest()
	
	function runTest(t, useSameClient, useOptimizations, cb){
		_.assertLength(arguments, 4)
		if(useOptimizations === 'yes'){
			runTestOnce(t, useSameClient, true, cb)
		}else if(useOptimizations === 'no'){
			runTestOnce(t, useSameClient, false, cb)
		}else{
			runTestOnce(t, useSameClient, false, function(){
				runTestOnce(t, useSameClient, true, cb)
			})
		}
	}
	function runTestOnce(t, useSameClient, useOptimizations, cb){
		_.assertLength(arguments, 4)
		
		var port = portCounter
		++portCounter;
		inProgress.push(t)
		var testDir = t.dir + '/' + t.name + '_test_'+(useSameClient?'yes':'no')+'_'+(useOptimizations?'yes':'no')
		
		usingSameClient = useSameClient
		usingOptimizations = useOptimizations

		var myServerList = currentServerList = []
		var myClientList = currentClientList = []

		var donePassed
		var testDescription = t.dirName+'.'+t.name+'[sameClient: ' + (useSameClient?'yes':'no') + ', optimizations: '+(useOptimizations?'yes':'no') + ']'
		function done(){
			log('test passed: ' + testDescription)
			if(donePassed){
				_.errout('repeat call')
			}
			donePassed = true
			++passedCount
			finish()
		}
		function fail(e){
			e = e || new Error('fail called, error unknown')
			if(donePassed) return
			log('test failed: ' + testDescription)
			++failedCount
			//console.log(e)
			failedList.push([testDescription, e.stack])
			log(e.stack)
			//process.exit(0)
			finish()
		}
		currentFail = fail
		done.fail = function(ee){
			if(_.isString(ee)) ee = new Error(ee)
			fail(ee)
		}
		
		var polls = []
		done.poll = function(f){
			var ci=setInterval(wf,10);
			function wf(){
				try{
					var res = f()
					if(res){
						polls.slice(polls.indexOf(ci), 1)
						clearInterval(ci)
					}
				}catch(e){
					fail(e)
				}
			}
			polls.push(ci)
		}
		
		var timeoutHandle
		
		function finish(){
			polls.forEach(function(ci){
				clearInterval(ci)
			})
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
				//console.log('schemaDir: ' + t.dir)
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
			fs.mkdir(testDir, function(err){
				if(err){
					if(err.code === 'EEXIST'){
						//log('making - with rimraf')
						rimraf(testDir, function(err){
							if(err){
								console.log('rimraf failed us')
								throw err
							}else{
								makeDir()
							}
						})
						return;
					}else{
						throw new Error('mkdir error: ' + err);
					}
				}else{			
					//console.log('made dir: ' + testDir)
					//console.log(new Error().stack)
					doTest()
				}
			})
		}
		makeDir()
	}
}*/

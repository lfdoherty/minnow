
var fs = require('fs')
var path = require('path')

var file_matcher = /\.js$/;

var _ = require('underscorem')

var rimraf = require('rimraf')


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
	
	var cdl = _.latch(dirs.length, moreCont)
	
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


function moreCont(){	

	var passedCount = 0;
	var failedCount = 0;
	
	var failedList = []
	var dieCdl = _.latch(tests.length, function(){
		console.log('all tests finished: ' + passedCount + '/' + (failedCount+passedCount));
		if(failedList.length > 0){
			console.log('failed: ')
			failedList.forEach(function(f){
				console.log(f[0] + ' failed')
				console.log(f[1])
			})
		}
		process.exit()
	})
	
	var inProgress = []
	
	var portCounter = 2000
	tests.forEach(function(t){
		var port = portCounter
		++portCounter;
		inProgress.push(t)
		var testDir = t.dir + '/' + t.name + '_test'

		function done(){
			log('test passed: ' + t.dirName + '.' + t.name)
			++passedCount
			finish()
		}
		function fail(e){
			log('test failed: ' + t.dirName + '.' + t.name)
			++failedCount
			//console.log(e)
			failedList.push([t.dirName+'.'+t.name, e.stack])
			log(e.stack)
			finish()
		}
		done.fail = function(ee){
			if(_.isString(ee)) ee = new Error(ee)
			fail(ee)
		}
		
		var timeoutHandle = setTimeout(function(){
			fail(new Error('test timed out'))
		}, 2000)
		
		function finish(){
			clearTimeout(timeoutHandle)
			var ii = inProgress.indexOf(t)
			inProgress.splice(ii, 1)

			rimraf(testDir, function(err){
				if(err) throw err;
				dieCdl()
			})
		}
		
		function doTest(){
			try{
				t.test(t.dir, testDir, port, done)
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
							makeDir()
						})
						return;
					}else{
						throw err;
					}
				}
			
				doTest()
			})
		}
		makeDir()
	})
}


var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = -1
exports.syntax = 'or(boolean,boolean,...)'
exports.nullsOk = true

var log = require('quicklog').make('or')

exports.compute = function(paramValues){
	log.info(JSON.stringify(paramValues))
	for(var i=0;i<paramValues.length;++i){
		if(_.isArray(paramValues[i])){
			var arr = paramValues[i]
			for(var j=0;j<arr.length;++j){
				if(arr[j]) return true
			}
		}else{
			if(paramValues[i]) return true
		}
	}
}

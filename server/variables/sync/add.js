
var _ = require('underscorem')

exports.type = function(paramTypes){
	_.assertDefined(paramTypes)
	_.assert(paramTypes[0].primitive || (paramTypes[0].members && paramTypes[0].members.primitive))
	var type = paramTypes[0].primitive
	if(type === undefined && paramTypes[0].members) type = paramTypes[0].members.primitive
	for(var i=1;i<paramTypes.length;++i){
		var otherType = paramTypes[i].primitive
		if(otherType === undefined && paramTypes[i].members) otherType = paramTypes[i].members.primitive
		if(type === 'int' && otherType === 'long'){
			type = 'long'
		}
		if(otherType === 'real'){
			type = 'real'
		}
	}
	return type
}
exports.minParams = 1
exports.maxParams = -1
exports.syntax = 'add(number|set:number,number|set:number,...)'
exports.nullsOk = true

var log = require('quicklog').make('add')

exports.compute = function(paramValues){
	var v = 0
	for(var i=0;i<paramValues.length;++i){
		if(paramValues[i] == null) continue
		if(_.isArray(paramValues[i])){
			var arr = paramValues[i]
			//arr.sort(function(a,b){return a-b})
			for(var j=0;j<arr.length;++j){
				_.assertNumber(arr[j])
				v += arr[j]
			}
		}else{
			//if(paramValues[i] === undefined) return//nulls are ok in arrays, but not single values
			v += paramValues[i]
		}
	}
	//console.log('added ' + JSON.stringify(paramValues) + ' -> ' + v)
	return v
}


var _ = require('underscorem');
var random = require('seedrandom')
var innerify = require('./innerId').innerify


exports.paramsStr = paramsStr
exports.paramStr = paramStr
exports.viewIdStr = viewIdStr
exports.parseId = parseId
exports.parseParams = parseParams
exports.parseViewId = parseViewId

function safeSplit(str, delim){
	var depth = 0
	var parts = []
	var cur = ''
	var inQuotes = false
	for(var i=0;i<str.length;++i){
		var c = str[i]
		if(c === '[') ++depth
		else if(c === ']') --depth
		else if(c === '"') inQuotes = !inQuotes
		else if(c === delim && depth === 0 && !inQuotes){
			parts.push(cur)
			cur = ''
			continue
		}
		cur += c			
	}
	if(cur.length > 0){
		parts.push(cur)
	}
	return parts
}

function parseId(ps){
	if(ps.length > 22){
		_.assertLength(ps, 45)
		//if(ps[0] !== '"') throw new Error('cannot parse: ' + ps)
		return parseComplexId(ps)//ps.substr(1,ps.length-2))
	}else{
		//_.assertLength(ps, 22)
		if(ps.length !== 22){
			throw new Error('cannot parse: ' + ps)
		}
		//if(ps[0] !== '"') throw new Error('cannot parse: ' + ps)
		return random.uuidBase64ToString(ps)//ps.substr(1,ps.length-2))
	}
}

function parseComplexId(ps){
	_.assertEqual(ps.length, 45)
	var nci = 22//ps.indexOf('_')
	/*if(ps[nci] !== '_'){
		for(var i=0;i<ps.length;++i){
			console.log(ps[i] + ' ' + i)
		}
		_.errout('cannot parse: ' + ps)
	}*/
	var a = ps.substr(0,nci)
	var b = ps.substr(nci+1)
	_.assertLength(a, 22)
	_.assertLength(b, 22)
	//var ia = parseInt(a)
	//var ib = parseInt(b)
	//if(isNaN(ia)) _.errout('failed to parse id: ' + a + ' ' + ps)
	//if(isNaN(ib)) _.errout('failed to parse id: ' + b + ' ' + ps)
	return innerify(random.uuidBase64ToString(a),random.uuidBase64ToString(b))
}


function parsePart(ps, psType){
	//
	if(psType.type.type === 'object'){
		return parseId(ps)
	}else if(psType.type.type === 'primitive'){
		if(psType.type.primitive === 'int'){
			return parseInt(ps)
		}else if(psType.type.primitive === 'string'){
			//if(ps[0] === '"') throw new Error('cannot parse: ' + ps)
			return ps.substr(1, ps.length-2)
			//return ps
		}else if(psType.type.primitive === 'uuid'){
			_.assertLength(ps, 22)
			//if(ps[0] !== '"') throw new Error('cannot parse: ' + ps)
			var res = random.uuidBase64ToString(ps)//ps//ps.substr(1, ps.length-2)
			_.assertLength(res, 8)
			return res
		}
	}e
	_.errout(JSON.stringify(psType) + ' ' + ps)
	if(ps.indexOf('[') === 0){
		return JSON.parse(ps)
	}else if(ps === 'undefined'){
		return undefined
	}else if(parseInt(ps)+'' === ps){
		return parseInt(ps)
	}/*else if(ps.length === 22 && ps.indexOf('"') === -1){
		return random.uuidStringToBuffer(ps)
	}*/else if(ps.indexOf('_') !== -1 && ps.indexOf('"') === -1){
		return parseComplexId(ps)
	}else{
		//console.log('ps: ' + ps)
		if(ps.indexOf('"') !== 0) _.errout('invalid: ' + ps)
		_.assert(ps.indexOf('"') === 0)
		return ps.substring(1,ps.length-1)
	}
}

function parseParams(paramsStr, paramTypes){
	_.assertLength(arguments, 2)
	_.assertDefined(paramTypes)
	_.assertEqual(paramsStr.substr(0,1), '[')
	paramsStr = paramsStr.substr(1, paramsStr.length-2)
	//console.log('parsing: ' + paramsStr)
	var parts = safeSplit(paramsStr, ',')
	var rest = []
	parts.forEach(function(part, index){
		if(index >= paramTypes.length){
			throw new Error('cannot parse params, too many: ' + paramsStr + ' ' + JSON.stringify(paramTypes))
		}
		var p = parsePart(part, paramTypes[index])
		if(!_.isString(p) && !_.isObject(p) && isNaN(p)) throw new Error('failed to parse: ' + part + ' ' + typeof(part) + ' ' + p + ' ' + typeof(p) + ' ' +  paramTypes[index].type.type + ' ' + paramTypes[index].type.primitive)
		//console.log('parsed ' + part + ' -> ' + p)
		rest.push(p)
	})
	return rest
}

function parseViewId(id, schema){
	_.assertDefined(schema)
	//console.log('view id: ' + id)
	var ci = id.indexOf('[')
	var typeCodeStr = id.substring(1, ci)
	
	var restStr = id.substring(ci+1,id.length-1)

	var parts = safeSplit(restStr, ',')
	var rest = []
	var paramTypes = schema._byCode[typeCodeStr].viewSchema.params
	parts.forEach(function(part, index){
		rest.push(parsePart(part, paramTypes[index]))
	})
	
	var res = {typeCode: parseInt(typeCodeStr), rest: rest}
	
	console.log('parsed viewId: ' + JSON.stringify(res))
	return res
}


function paramsStr(params, paramTypes){
	_.assertDefined(paramTypes)
	
	var str = '['
	for(var i=0;i<params.length;++i){
		if(i>0) str += ','
		str+=paramStr(params[i], paramTypes[i])
	}
	str += ']'
	return str
}

function paramStr(v, pt){
	//console.log(JSON.stringify(paramTypes) + ' ' + i)
	if(pt.type.type === 'object'){
		if(_.isString(v)){
			if(v.length === 8){
				v = random.uuidStringToBase64(v)	
			}else{
				_.assertLength(v, 22)
			}
		}else{
			try{
				v = random.uuidStringToBase64(v.top)+'_'+random.uuidStringToBase64(v.inner)
			}catch(e){
				console.log('error converting: ' + JSON.stringify(v))
				v = ''
			}
		}
	}else if(pt.type.primitive === 'uuid'){
		if(v.length === 8){
			v = random.uuidStringToBase64(v)	
		}else if(v.length === 22){
		}else{
			console.log('error converting: ' + v)
		}
	}else if(pt.type.primitive === 'string'){
		if(!v || v[0] === '"') throw new Error('here: ' + v)
		v = '"'+v+'"'
	}
	if(_.isArray(v)) _.errout('invalid array type?: ' + viewCode + ' ' + JSON.stringify(params))
	if(v+'' === '[object Object]') _.errout('cannot parameterize: ' + JSON.stringify(v) + ' ' + v)
	if((v+'').indexOf('{') !== -1) _.errout('cannot parameterize: ' + JSON.stringify(v) + ' ' + v)
	//str += v
	return v
}

function viewIdStr(viewCode,params, typeSchema){
	_.assertLength(arguments, 3)

	var str = ':'+viewCode+paramsStr(params, typeSchema.viewSchema.params)

	
	
	return str
}


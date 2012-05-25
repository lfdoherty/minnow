"use strict";

var fs = require('fs');

var myrtle = require('myrtle-parser');

var keratin = require('keratin');

var _ = require('underscorem');

var util = require('util');

var reservedTypeNames = ['invariant', 'readonly', 'recursively_readonly', 'abstract', 'type', 'in', 'is', 'and', 'or', 'id'];

function loadViews(schemaDir, str, schema, cb){

	var view = myrtle.parse(str);
	view = viewMinnowize(schemaDir, view, schema);
	
	_.each(view, function(view, viewName){
		schema._byCode[view.code] = view.schema;
		schema[viewName] = view.schema;
		view.schema.isView = true;
		view.schema.code = view.code;
		view.schema.viewSchema = JSON.parse(JSON.stringify(view));
	});
	
	cb();
}

function readAllSchemaFiles(schemaDir, cb){
	var strs = []
	fs.readdir(schemaDir, function(err, files){
		if(err) throw err;
		var minnowFiles = []
		//console.log('readdir: ' + JSON.stringify(files))
		files.forEach(function(f){
			var mi = f.indexOf('.minnow')
			if(mi !== -1 && mi === f.length-'.minnow'.length){
				minnowFiles.push(schemaDir + '/' + f)
			}
		})
		var cdl = _.latch(minnowFiles.length, function(){
			if(strs.length === 0) _.errout('no schema files found in dir: ' + schemaDir)
			cb(strs, minnowFiles)
		})
	//	console.log('readdir-minnow: ' + JSON.stringify(minnowFiles))
		minnowFiles.forEach(function(f){
			fs.readFile(f, 'utf8', function(err, str){
				if(err) throw err;
				strs.push(str)
				cdl()
			})
		})
	})
}

exports.load = function(schemaDir, cb){
	_.assertLength(arguments, 2)
	
	schemaDir = schemaDir || process.cwd();
	
	//var schemaPath = schemaDir + '/' + schemaName+'.minnow';
	console.log('loading all schemas in dir: ' + schemaDir)
	
	//fs.readFile(schemaPath, 'utf8', function(err, str){
	//	if(err) throw err;
	readAllSchemaFiles(schemaDir, function(strs, allFiles){
		var str = strs.join('\n')
		
	//	console.log('str: ' + str)
		
		var schema;
		try{
			schema = keratin.parse(str, reservedTypeNames);
		}catch(e){
			console.log('keratin failed parsing: ' +schemaDir);
			throw e;
		}
		
		loadViews(schemaDir, str, schema, function(){
			var takenObjectTypeCodes = {}
		//	console.log('many schema: ' + _.size(schema))
			_.each(schema, function(st, name){
				if(takenObjectTypeCodes[st.code]){
					console.log('ERROR while processing files: ' + JSON.stringify(allFiles))
					throw new Error('type code of ' + name + ' already taken: ' + st.code);
				}
				takenObjectTypeCodes[st.code] = true
				_.each(st.superTypes, function(v, superType){
					if(reservedTypeNames.indexOf(superType) === -1){
						if(schema[superType] === undefined) _.errout('cannot find super type "' + superType + '" of "' + name + '"');
						schema[superType].subTypes[name] = true;
					}
				});
			});
			
			cb(schema);
		});		
	});
}

function parseInfix(expr, name){
	var infix = ' ' + name + ' ';
	var ls = expr.substr(0, expr.indexOf(infix));
	var rs = expr.substr(expr.indexOf(infix)+4);
	return {type: name, subject: parsePath(ls), constraint: parsePath(rs)};
}

var ampersandParam = {type: 'param', name: '&'}

function safeSplit(str, delim){
	
	
	var res = [];
	var cur = '';
	
	var square=0, curly=0, round=0, angle=0;
	for(var i=0;i<str.length;++i){
		var c = str.charAt(i);
		if(c === '[') ++square;
		else if(c === ']') --square;
		else if(c === '{') ++curly;
		else if(c === '}') --curly;
		else if(c === '(') ++round;
		else if(c === ')') --round;
		else if(c === '<') ++angle;
		else if(c === '>') --angle;

		if(c === delim && square === 0 && curly === 0 && round === 0 && angle === 0){
			cur = cur.trim();
			res.push(cur);
			cur = '';			
		}else{
			cur += c;
		}
	}
	
	cur = cur.trim();
	res.push(cur);
	
	if(square !== 0) _.errout('mismatched [] brackets: ' + str);
	if(curly !== 0) _.errout('mismatched {} brackets: ' + str);
	if(round !== 0) _.errout('mismatched () brackets: ' + str);

	//console.log('safeSplit: ' + str)
	//console.log('res: ' + res)
	
	return res;
}

function subIndex(i, ei){
	if(i === -1) return ei;
	if(ei !== -1 && ei < i) return ei;
	return i;
}

var alphaRegex = /^[0-9A-Za-z]+$/;
function checkAlphanumericOnly(str, msg){
	if(str === '&') return;
	if(!alphaRegex.test(str)){
		_.errout(msg);
	}
}

function parseViewExpr(expr){
	var path = [];
	
	while(expr.length > 0){
		//console.log('expr: ' + expr)
		var fc = expr.charAt(0);
		if(fc === '['){
			var end = expr.lastIndexOf(']');
			if(end === -1) _.errout('mismatched filter brackets(' + expr + ')');
			var head = expr.substring(1, end);
			expr = expr.substr(head.length+2);
			//path.push({type: 'filter', expr: parseConstraint(head)});
			//console.log('(' + head + ')');
			var macroExpr = {type: 'view', view: 'filter', params: [ampersandParam, parseViewExpr(head)]};
			path.push({type: 'macro', expr: macroExpr});
		}else if(fc === '{'){
			var inner = expr.substring(1, expr.indexOf('}'));
			path.push({type: 'macro', expr: parseViewExpr(inner)});
			break;
		}else if(fc === '<'){
			var inner = expr.substring(1, expr.indexOf('>'));
			//console.log('expr: ' + expr)
			var both = safeSplit(inner, ',');//expr: parseViewExpr(inner)
			_.assertLength(both, 2);
			path.push({type: 'map-macro', keyExpr: parseViewExpr(both[0]), valueExpr: parseViewExpr(both[1])});
			break;
		}else if(fc === "'"){
			var str = expr.substring(1, expr.length-1);
			path.push({type: 'value', value: str});
			break;
		}else if(fc === '*'){
			var filter;
			var typeName;
			
			var typeNameEndIndex = expr.indexOf('[');
			typeNameEndIndex = subIndex(typeNameEndIndex, expr.indexOf('.'));
			typeNameEndIndex = subIndex(typeNameEndIndex, expr.indexOf('{'));
			typeNameEndIndex = subIndex(typeNameEndIndex, expr.indexOf('<'));
			typeNameEndIndex = subIndex(typeNameEndIndex, expr.length);

			typeName = expr.substring(expr.indexOf('*')+1, typeNameEndIndex);
			expr = expr.substr(typeNameEndIndex);
			
			path.push({type: 'type', name: typeName});
			
		}else if(fc === '.'){
			var end = expr.indexOf('[');
			var doti = expr.indexOf('.', 1);
			if(end === -1) end = expr.indexOf(' ');
			if(end === -1) end = expr.indexOf('{');
			if(end === -1) end = expr.length;
			if(doti !== -1 && doti < end) end = doti;
			var dotc = expr.indexOf('{');
			if(dotc !== -1 && dotc < end) end = dotc;
			path.push({type: 'property', name: expr.substring(1, end)});
			//console.log('adjusted expression: ' + expr);
			expr = expr.substr(end);
			//console.log('adjusted expression: ' + expr);
		}else if(expr.indexOf('(') !== -1 && expr.indexOf('{') === -1){
			var viewName = expr.substr(0, expr.indexOf('('));
			//console.log('viewName: ' + viewName);
			var paramStr = expr.substring(expr.indexOf('(')+1, expr.lastIndexOf(')'));
			var paramStrs = safeSplit(paramStr, ',');

			var params = [];
			_.each(paramStrs, function(ps){
				params.push(parseViewExpr(ps.trim()));
			});
			path.push({type: 'view', params: params, view: viewName});
			//break;
			expr = expr.substr(expr.lastIndexOf(')')+1);
		}else if(expr.indexOf('(') !== -1 && expr.indexOf('{') !== -1){
			var viewName = expr.substr(0, expr.indexOf('('));
			//console.log('viewName: ' + viewName);
			var viewEndIndex = expr.lastIndexOf(')', expr.indexOf('{'));
			var paramStr = expr.substring(expr.indexOf('(')+1, viewEndIndex);
			//console.log('expr: ' + expr);
			var paramStrs = safeSplit(paramStr, ',');

			var params = [];
			_.each(paramStrs, function(ps){
				params.push(parseViewExpr(ps.trim()));
			});
			path.push({type: 'view', params: params, view: viewName});
			//break;
			//console.log('adjusted expression: ' + expr);
			expr = expr.substr(viewEndIndex+1);
			//console.log('adjusted expression: ' + expr);
		}else{
			if(expr.indexOf('.') !== -1){
				var firstPart = expr.substr(0, expr.indexOf('.'));
				firstPart = firstPart.trim();
				checkAlphanumericOnly(firstPart, 'parameter name must contain only alphanumeric characters (' + firstPart + ')');
				path.push({type: 'param', name: firstPart});
				expr = expr.substr(expr.indexOf('.'));
				//console.log(expr);
			}else{
				expr = expr.trim();
				checkAlphanumericOnly(expr, 'parameter name must contain only alphanumeric characters (' + expr + ')');
				path.push({type: 'param', name: expr});
				break;
			}
		}
	}
	return invertViewExpression(path);
}

function invertViewExpression(arr){

	_.assertArray(arr);
	
	var e;
	if(arr.length === 1){
		e = arr[0];
	}else{
		var last = arr[arr.length-1];
		var rest = arr.slice(0, arr.length-1);
		last.context = invertViewExpression(rest);
		e = last;
	}
	
	return e;
}

function computePathResultType(path, baseType, context, schema, viewMap){
	_.assertLength(arguments, 5);
	_.assertObject(baseType);
	var t = baseType;
	_.each(path, function(p){
		if(p.type === 'filter'){
			//do nothing
		}else if(p.type === 'property'){
			//console.log(t);
			t = t.properties[p.property];
			if(t === undefined){
				_.errout('unknown property: ' + p.property);
			}
			//console.log('here:');
			_.assertObject(t);
		}else if(p.type === 'macro'){
			//console.log('macro input t: ' + JSON.stringify(t));
			var input = t;
			t = computeType(p.expr, context, schema, viewMap);
			if(input.type.type === 'set'){
				t = {type: 'set', members: t};
			}else if(input.type.type === 'list'){
				t = {type: 'list', members: t};
			}
			//console.log(t);
			_.assertObject(t);
		}else{
			_.errout('TODO support path part type: ' + p.type);
		}
	});
	return t;
}

var builtinViews = {
	count: {
		code: 255
	},
	filter: {
		code: 254
	},
	unique: {
		code: 253
	},
	max: {
		code: 252
	},
	min: {
		code: 251
	},
	one: {
		code: 250
	},
	get: {
		code: 249
	}
};

function computeType(rel, v, schema, viewMap, macroType){
	//_.assertLength(arguments, 4);
	_.assert(arguments.length >= 4);
	_.assert(arguments.length <= 5);
	_.assertObject(rel);
	
	//console.log('finding param: ' + JSON.stringify(rel));
	if(rel.type === 'param' && rel.name === '&'){
		//_.errout('TODO: ' + JSON.stringify(rel));
		//look up current macro type
		_.assertDefined(macroType);
		return macroType;
	}else if(rel.type === 'param'){
		 var vv = _.detect(v.params, function(p){
			if(p.name === rel.name) return true;
		})
		if(vv === undefined){
			_.errout('cannot find param: ' + rel.name + ' (' + JSON.stringify(v.params) + ')');
		}
		_.assertObject(vv.type);
		return vv.type;
	}else if(rel.type === 'param-path'){
		var initialTypeName = _.detect(v.params, function(p){
			if(p.name === rel.path[0].name) return true;
		}).type;
		if(initialTypeName === undefined){
			_.errout('parameter not found: ' + rel.path[0].name);
		}
		var initialType = schema[initialTypeName.object];
		//_.assertObject(initialType);
		if(initialType === undefined){
			_.errout('object type not found: ' + JSON.stringify(initialTypeName));
		}
		var res = computePathResultType(rel.path.slice(1), initialType, v, schema, viewMap);
		return res;
	}else if(rel.type === 'view'){
		var v = viewMap[rel.view];
		if(v === undefined){
			v = builtinViews[rel.view];
		}
		if(schema[rel.view]){
			return {type: 'object', object: rel.view, code: schema[rel.view].code};
		}
		if(v === undefined){
			_.errout('unknown view referred to: ' + rel.view);
		}
		//_.assertObject(v);
		//console.log('rel: ');
		//console.log(JSON.stringify(rel));
		//return {type: 'view', view: rel.view, viewCode: v.code};//code: v.code, hintName: rel.view};
		if(rel.view === 'count'){
			return {type: 'primitive', primitive: 'int'};
		}else if(rel.view === 'unique'){
			//_.errout('TODO');
			return {type: 'set', members: computeType(rel.params[0], v, schema, viewMap, macroType)};
		}else if(rel.view === 'max'){
			var valuesType = computeType(rel.params[0], v, schema, viewMap, macroType);
			_.assert(valuesType.type === 'set' || valuesType.type === 'list')
			_.assertEqual(valuesType.members.type, 'primitive');
			return {type: 'primitive', primitive: valuesType.members.primitive};
		}else if(rel.view === 'filter'){
			return computeType(rel.params[0], v, schema, viewMap, macroType);
		}else if(rel.view === 'one'){
			var t = computeType(rel.params[0], v, schema, viewMap, macroType);
			//console.log('one: ' + JSON.stringify(t));
			return t.members;
		}else if(rel.view === 'get'){
			var typeName = rel.params[0].name;
			var t = schema[typeName];
			return {type: 'object', object: t.name, code: t.code};
		}else{
			//_.errout('TODO view type computation: ' + JSON.stringify(rel));
			//var viewSchema = schema[rel.view];
			//return {type: 'view', view: rel.view, viewCode: v.code};
			return {type: 'object', object: rel.view, viewCode: v.code, code: v.code};
		}
	}else if(rel.type === 'type'){
		var t = schema[rel.name];
		if(t === undefined){
			_.errout('unknown type: ' + rel.name);
		}
		
		//TODO: detect when a list or singleton is the destination type
		var res = computePathResultType(rel.path, t, v, schema, viewMap);
		_.assertObject(res);
		return {type:'set', members: {type: 'object', object: res.name, objectCode: res.code}};//code: res.code, hintName: res.name}};
	}else if(rel.type === 'property'){
		var ct = computeType(rel.context, v, schema, viewMap, macroType);
		if(ct.type === 'set'){
			if(ct.members.type === 'object'){
				var mos = schema[ct.members.object];
				var ps = mos.properties[rel.name];
				_.assertDefined(ps);
				//return ps;
				return {type:'set', members: ps.type};
			}else if(ct.members.type.type === 'map'){
				return {type:'set', members: ct.members.type.value};
			}else{
				_.errout('TODO: ' + JSON.stringify(ct));
			}
		}else if(ct.type === 'view'){
			//console.log(viewMap[ct.view]);
			var vv = viewMap[ct.view];
			_.assertObject(vv);
			//console.log(vv);
			var p = vv.schema.properties[rel.name];
			_.assertObject(p);
			//console.log(p);
			_.errout('TODO: ' + JSON.stringify(ct));
			return p.type;
		}else if(ct.type === 'object'){
			var objSchema = schema[ct.object];
			_.assertObject(objSchema);
			//console.log(vv);
			if(rel.name === 'id'){
				return {type: 'primitive', primitive: 'int'};
			}
			var p = objSchema.properties[rel.name];
			if(p === undefined) _.errout('cannot find property ' + objSchema.name + '.' + rel.name);
			_.assertObject(p);
			//console.log(p);
			//_.errout('TODO: ' + JSON.stringify(ct));
			return p.type;
		}else{
			_.errout('TODO: ' + JSON.stringify(ct));
		}
	}else if(rel.type === 'macro'){
		var mt = computeType(rel.context, v, schema, viewMap, macroType);
		_.assertObject(mt);
		_.assert(mt.type === 'set' || mt.type === 'list');
		var exprType = computeType(rel.expr, v, schema, viewMap, mt.members);
		//console.log(JSON.stringify(exprType));
		//console.log(JSON.stringify(mt));
		//_.errout('TODO');
		//_.assert(exprType.type  === 'set' || exprType.type === 'list');
		return {type: mt.type, members: exprType};
	}else if(rel.type === 'map-macro'){
		var mt = computeType(rel.context, v, schema, viewMap, macroType);
		_.assertObject(mt);
		_.assert(mt.type === 'set' || mt.type === 'list');
		var keyExprType = computeType(rel.keyExpr, v, schema, viewMap, mt.members);
		var valueExprType = computeType(rel.valueExpr, v, schema, viewMap, mt.members);
		//console.log(JSON.stringify(keyExprType));
		//console.log(JSON.stringify(valueExprType));
		//console.log(JSON.stringify(mt));
		//_.errout('TODO');
		//_.assert(exprType.type  === 'set' || exprType.type === 'list');
		return {type: 'map', key: keyExprType, value: valueExprType};
	}else{
		_.errout('TODO: support rel type: ' + rel.type);
	}
}

function makeViewSchema(v, schema, result, viewMap){
	result.properties = {};
	result.propertiesByCode = {};
	result.superTypes = {readonly: true, recursively_readonly: true};
	
	_.each(v.rels, function(rel, name){
		var p = result.properties[name] = {};
		p.name = name;
		p.type = computeType(rel, v, schema, viewMap);
		_.assertInt(rel.code);
		p.code = rel.code;
		p.tags = {};
		_.assertNumber(p.code);
		//console.log(p.code);
		result.propertiesByCode[p.code] = p;
	});
	
	return result;
}
/*
function replaceSingleSugar(rel){
	var typeName = rel.params[0]
	var idExpr = rel.params[1]
	console.log('single ' + JSON.stringify([typeName, idExpr]))
	var res = {type: 'view',
		code: rel.code,
		view: 'one',
		params: [{
			type: 'macro',
			expr: {
				type: 'view',
				view: 'filter',
				params: [
					ampersandParam,
					{
						type: 'view',
						view: 'is',
						params: [
							{
								type: 'property',
								property: 'id',
								context: ampersandParam
							},
							idExpr
						]
					}							
				]
			},
			context: {
				type: 'type',
				name: typeName.name
			}
		}]
	}
	return res
}
function replaceSyntaxSugar(v){
	_.each(v.rels, function(rel, relName){
		if(rel.type === 'view' && rel.view === 'single'){
			console.log(util.inspect(rel))
			v.rels[relName] = replaceSingleSugar(rel)
		}
	})
}*/

function viewMinnowize(schemaDir, view, schema){
	_.assertLength(arguments, 3);
	_.assertObject(schema);

	var takenCodes = {};
	_.each(_.byCode, function(value, typeCodeStr){
		_.assertInt(value.code);
		takenCodes[value.code] = true;
	});
	
	//console.log(JSON.stringify(view));
	var result = {};
	
	_.each(view.children, function(v){
		var expr = v.tokens[0];
		var obi = expr.indexOf('(')
		if(obi === -1) return;//skip non-views (objects)
		var cbi = expr.indexOf(')')
		var name = expr.substr(0, obi);
		if(reservedTypeNames.indexOf(name) !== -1) _.errout('using reserved name: ' + name);
		var params = expr.substring(obi+1, cbi);
		if(params.trim().length > 0){
			params = params.split(',');
		}else{
			params = [];
		}
		//console.log([name, params, expr]);
		params = _.map(params, function(p, index){
			var sp = p.trim().split(' ');

			if(reservedTypeNames.indexOf(sp[0]) !== -1) _.errout('using reserved name: ' + sp[0]);
		
			return {type: keratin.parseType(sp[1]), name: sp[0], index: index};
		});
		var code = parseInt(v.tokens[1]);
		if(takenCodes[code]){
			_.errout('view ' + name + ' is using a code that is already taken: ' + code);
		}
		//console.log('view: ' + name);
		takenCodes[code] = true;
		//console.log(params);
		var vn = {params: params, paramsByName: {}, rels: {}, code: code, superTypes: {}};
		result[name] = vn;
		
		_.each(params, function(p){
			vn.paramsByName[p.name] = p;
		});
		
		var relTakenCodes = {};
		_.each(v.children, function(r){
			
			if(r.tokens.length < 3) _.errout('view rels must have the syntax: <name> <expression> <code>\n' + JSON.stringify(r));
			
			var rName = r.tokens[0];
			var rExpr = r.tokens[1];
			vn.rels[rName] = parseViewExpr(rExpr);
			var cc = parseInt(r.tokens[2]);
			if(!_.isInt(cc)) _.errout('rel code must be an integer: ' + JSON.stringify(r));
			_.assertInt(cc);
			if(relTakenCodes[cc]){
				_.errout('view rel ' + rName + ' is using a code that is already taken: ' + cc);
			}
			//console.log(rName + ': ' + cc);
			relTakenCodes[cc] = true;
			_.assertInt(cc);
			vn.rels[rName].code = cc;
			//vn.rels[rName].tags = {};
		});
		vn.schema = {};
	});
	
	
	var vsStr = '';
	
	//we do this separately to resolve circular dependencies
	_.each(result, function(vn, name){

		//replaceSyntaxSugar(vn)

		makeViewSchema(vn, schema, vn.schema, result);
		vsStr += keratin.stringize(vn.schema, name, vn.code, function(t){
			if(t.type === 'view'){
				if(t.view === 'count'){
					return 'int';
				}else{
					return t.view;
				}
			}
		});
		vsStr += '\n';
	});
	
	fs.writeFile(schemaDir + '/view.schema.generated', vsStr, 'utf8');
	
	//console.log(JSON.stringify(result));
	
	return result;
}

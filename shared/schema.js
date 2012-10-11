"use strict";

var fs = require('fs');

var myrtle = require('myrtle-parser');

var keratin = require('keratin');

var _ = require('underscorem');

var util = require('util');

//builtin stuff

var reservedTypeNames = ['invariant', 'readonly', 'recursively_readonly', 'abstract', 'type', 'in', 
	'is', 'and', 'or', 'id',
	'div', 'add', 'sub', 'mul'];
	
var builtinFunctions = {}
exports.addFunction = function(name, def){
	builtinFunctions[name] = def
}
var syncPlugins

var sugar = {}
exports.addSugar = function(name, def){
	sugar[name] = def
}

exports.getImplementation = function(name){
	var def = builtinFunctions[name]
	if(def === undefined){
		def = syncPlugins[name]
	}
	if(def === undefined) throw new Error('unknown view: ' + name)
	return def
}


var log = require('quicklog').make('minnow/schema')

function loadViews(schemaDirs, str, schema, synchronousPlugins, cb){

	var view = myrtle.parse(str);
	view = viewMinnowize(schemaDirs, view, schema, synchronousPlugins);
	
	_.each(view, function(view, viewName){
		if(view.schema){
			schema._byCode[view.code] = view.schema;
			schema[viewName] = view.schema;
			view.schema.isView = true;
			view.schema.code = view.code;
			view.schema.viewSchema = JSON.parse(JSON.stringify(view));
		}
	});
	
	cb();
}

function concretizeMacros(view){
	_.each(view, function(v, viewName){
		if(v.schema){
			concretizeMacrosForView(v, view)
		}
	})
}
function concretizeMacrosForView(v, viewMap){
	var bindings = {}
	v.params.forEach(function(p){
		_.assertString(p.name)
		bindings[p.name] = {type: 'param', name: p.name}
	})
	_.each(v.rels, function(rel, relName){
		var newRel = v.rels[relName] = concretizeViewExpression(rel, viewMap, bindings)
		newRel.code = rel.code
	})
}
function concretizeViewExpression(expr, viewMap, bindings){
	var res = replaceReferencesToParams(expr, viewMap, bindings, [])
	return res
}

function replaceReferencesToParams(expr, viewMap, bindings, implicits, leavePartials){
	_.assertArray(implicits)
	
	if(expr.type === 'param'){
		if(bindings[expr.name] !== undefined){
			if(bindings[expr.name].type === 'param') return bindings[expr.name]
			if(leavePartials){
				return bindings[expr.name]
			}else{
				return replaceReferencesToParams(bindings[expr.name], viewMap, bindings, implicits)
			}
		}else{
			if(expr.name.charAt(0) === '~'){
				if(expr.name.length === 1){
					if(implicits[0] === undefined) _.errout('tried to use ~ param outside of macro')
					_.assertString(implicits[0])
					return {type: 'param', name: implicits[0]}
				}else{
					var num = parseInt(expr.name.substr(1))
					--num
					_.assertString(implicits[num])
					return {type: 'param', name: implicits[num]}
				}
			}
			
			return expr;

		}
	}else if(expr.type === 'view'){
		var gm;
		if(viewMap[expr.view] !== undefined && viewMap[expr.view].code === undefined){
			gm = viewMap[expr.view]
		}else if(bindings[expr.view] !== undefined){
			if(bindings[expr.view].type === 'global-macro' || bindings[expr.view].type === 'partial-application' || bindings[expr.view].type === 'macro'){
				gm = bindings[expr.view]
			}else{
				_.errout('TODO: ' + JSON.stringify(expr) + '\n' + JSON.stringify(bindings[expr.view]))			
			}
		}
		
		var newParams = []
		expr.params.forEach(function(p, index){
			var np = newParams[index] = replaceReferencesToParams(p, viewMap, bindings, implicits, !!gm)//!!gm because views aren't allowed to take macros (so we cannot leavePartials), but everything else we might call is
			if(!gm) _.assert(np.type !== 'partial-application')
		})
		
		if(gm){
			if(leavePartials) return expr
			if(gm.type === 'global-macro'){
				var newBindings = {}
				gm.params.forEach(function(p, index){
					newBindings[p.name] = newParams[index]
				})
				var res = replaceReferencesToParams(gm.expr, viewMap, newBindings, implicits)
				return res
			}else if(gm.type === 'specialization'){
				var concreteCases = []
				gm.cases.forEach(function(c, index){
					var cm = viewMap[c]
					var newBindings = {}
					//var signature = {}
					cm.params.forEach(function(p, index){
						newBindings[p.name] = newParams[index]
						//signature[p.name] = p.type
					})
					var res = replaceReferencesToParams(cm.expr, viewMap, newBindings, implicits)					
					concreteCases.push({expr: res, signature: cm.params})
				})
				return {type: 'concrete-specialization', cases: concreteCases, name: gm.name}
				
			}else if(gm.type === 'partial-application'){
				var newBindings = {}
				var pa = gm
				var gm = viewMap[pa.macro]
				pa.params.forEach(function(paramExpr, index){
					var paramName = gm.params[index].name
					_.assertString(paramName)
					newBindings[paramName] = replaceReferencesToParams(paramExpr, viewMap, bindings, implicits)
				})
				var realIndex = pa.params.length
				newParams.forEach(function(paramExpr, index){
					var paramName = gm.params[realIndex].name
					_.assertString(paramName)
					newBindings[paramName] = replaceReferencesToParams(paramExpr, viewMap, bindings, implicits)
					++realIndex
				})
				return replaceReferencesToParams(gm.expr, viewMap, newBindings, implicits)
			}else if(gm.type === 'macro'){
				if(expr.params.length > 2) _.errout('TODO allow calling a macro with more than 2 parameters, somehow?')
				var newBindings = {}
				_.assertUndefined(expr.implicits)
				var newImplicits = gm.implicits
				expr.params.forEach(function(dummy,index){
					newBindings[newImplicits[index]] = newParams[index]
				})
				return replaceReferencesToParams(gm.expr, viewMap, newBindings, newImplicits)
			}else{
				_.errout('TODO: ' + JSON.stringify(gm))
			}
		}else{
			var v = {type: 'view', view: expr.view, params: newParams}
			if(expr.view === 'each'){
				if(v.params[1].type === 'partial-application'){
					throw new Error()
				}
			}
			return v;
		}
	}else if(expr.type === 'partial-application'){
		if(leavePartials){
			expr.sourceBindings = bindings
			return expr
		}
		if(viewMap[expr.macro] !== undefined){
			var gm = viewMap[expr.macro]
			if(gm.type === 'global-macro'){
				var newBindings = {}
				var fullBindings = _.extend({}, bindings, expr.sourceBindings)
				expr.params.forEach(function(paramExpr, index){
					var paramName = gm.params[index].name
					_.assertString(paramName)
					newBindings[paramName] = replaceReferencesToParams(paramExpr, viewMap, fullBindings, implicits)
				})
				_.assertUndefined(expr.implicits)
				var newImplicits = makeImplicits()
				return {type: 'macro', expr: replaceReferencesToParams(gm.expr, viewMap, newBindings, newImplicits), implicits: newImplicits}
			}
		}
		throw new Error('partial-application not completed: ' + JSON.stringify(expr))
		return expr
	}else if(expr.type === 'value' || expr.type === 'int'){
		return expr
	}else if(expr.type === 'array'){
		return expr
	}else if(expr.type === 'macro'){
		var newImplicits
		if(expr.implicits){
			newImplicits = expr.implicits
		}else{
			newImplicits = makeImplicits()
		}
		var newBindings = _.extend({}, bindings)
		return {type: 'macro', expr: replaceReferencesToParams(expr.expr, viewMap, newBindings, newImplicits), implicits: newImplicits}
	}else{
		_.errout('TODO: ' + JSON.stringify(expr))
	}
}

function makeImplicits(){
	var newImplicits = []
	for(var i=0;i<10;++i){
		newImplicits.push('p'+(i+1)+'_'+Math.random())
	}
	return newImplicits
}

function computeBindingsUsedByMacros(view){

	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				computeBindingsUsed(rel)
			})
		}
	})
}

function computeBindingsUsed(expr){
	if(expr.type === 'macro'){
		var used = computeBindingsUsed(expr.expr)
		expr.bindingsUsed = used
		return used
	}else if(expr.type === 'view'){
		var all = {}
		_.each(expr.params, function(param){
			var used = computeBindingsUsed(param)
			Object.keys(used).forEach(function(u){all[u] = true;})
		})
		return all
	}else if(expr.type === 'param'){
		//ignore
		var u = Object.create(null)
		u[expr.name] = true
		return u
	}else if(expr.type === 'value' || expr.type === 'int' || expr.type === 'array'){
		//ignore
		return Object.create(null)
	}else if(expr.type === 'concrete-specialization'){
		var all = {}
		_.each(expr.cases, function(c){
			var used = computeBindingsUsed(c.expr)
			Object.keys(used).forEach(function(u){all[u] = true;})
		})
		return all
	}else{
		_.errout('TODO: ' + JSON.stringify(expr))
	}
}

function readAllSchemaFiles(schemaDir, cb){
	var strs = []
	fs.readdir(schemaDir, function(err, files){
		if(err) throw err;
		var minnowFiles = []
		minnowFiles.push(__dirname + '/builtins.minnow')
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
		minnowFiles.forEach(function(f){
			fs.readFile(f, 'utf8', function(err, str){
				if(err) throw err;
				strs.push(str)
				cdl()
			})
		})
	})
}

exports.load = function(schemaDir, synchronousPlugins, cb){
	_.assertLength(arguments, 3)

	schemaDir = schemaDir || process.cwd();
	
	var osp = synchronousPlugins
	synchronousPlugins = {}
	_.each(osp, function(plugin, pluginName){
		log('plugin: ' + JSON.stringify(Object.keys(plugin)))
		if(plugin.compute === undefined) _.errout('plugin ' + pluginName + ' must define a "compute" function!')
		if(plugin.type === undefined) _.errout('plugin ' + pluginName + ' must define a "type" function describing its output type.')
		if(plugin.minParams === undefined) _.errout('plugin ' + pluginName + ' must define a "minParams" int describing its call syntax (for error-reporting purposes.)')
		if(plugin.maxParams === undefined) _.errout('plugin ' + pluginName + ' must define a "minParams" int describing its call syntax (for error-reporting purposes.)')
		if(plugin.syntax === undefined) _.errout('plugin ' + pluginName + ' must define a "syntax" string describing its call syntax (for error-reporting purposes.)')
		synchronousPlugins[pluginName] = {
			isSynchronousPlugin: true,
			schemaType: function(rel){
				var paramTypes = []
				_.each(rel.params, function(p){
					paramTypes.push(p.schemaType)
				})
				//console.log('parsing plugin: ' + pluginName)
				return keratin.parseType(plugin.type(paramTypes, rel.params))
			},
			implementation: plugin.compute,
			minParams: plugin.minParams,
			maxParams: plugin.maxParams,
			callSyntax: plugin.syntax
		}
	})

	syncPlugins = synchronousPlugins
	
	log('loading all schemas in dir: ' + schemaDir)
	
	var schemaDirs = _.isString(schemaDir) ? [schemaDir] : schemaDir
	var str = ''
	//console.log('schemaDirs: ' + JSON.stringify(schemaDirs))
	_.each(schemaDirs, function(schemaDir){
		readAllSchemaFiles(schemaDir, function(strs, allFiles){
			str += strs.join('\n')
			cdl()
		})
	})
		
	var cdl = _.latch(schemaDirs.length, function(){
		var schema;
		try{
			schema = keratin.parse(str, reservedTypeNames);
		}catch(e){
			log('keratin failed parsing: ' +schemaDir);
			throw e;
		}
		
		loadViews(schemaDir, str, schema, synchronousPlugins, function(globalMacros){
			var takenObjectTypeCodes = {}
			_.each(schema, function(st, name){
				if(takenObjectTypeCodes[st.code]){
					log('ERROR while processing files: ' + JSON.stringify(allFiles))
					throw new Error('type code of ' + name + ' already taken: ' + st.code);
				}
				takenObjectTypeCodes[st.code] = true
				if(st.superTypes){
					_.each(st.superTypes, function(v, superType){
						if(reservedTypeNames.indexOf(superType) === -1){
							if(schema[superType] === undefined) _.errout('cannot find super type "' + superType + '" of "' + name + '"');
							if(schema[superType].subTypes === undefined) schema[superType].subTypes = {}
							schema[superType].subTypes[name] = true;
						}
					});
				}
			});
			
			cb(schema, globalMacros);
			log('done load cb')
		});		
		log('done...')
	});
}

function parseInfix(expr, name){
	var infix = ' ' + name + ' ';
	var ls = expr.substr(0, expr.indexOf(infix));
	var rs = expr.substr(expr.indexOf(infix)+4);
	return {type: name, subject: parsePath(ls), constraint: parsePath(rs)};
}

//var ampersandParam = {type: 'param', name: '~'}

function findOuterChar(str, char){
	
	
	var square=0, curly=0, round=0, angle=0;
	for(var i=0;i<str.length;++i){
		var c = str.charAt(i);

		if(c === char && square === 0 && curly === 0 && round === 0 && angle === 0){
			return i;
		}
		
		if(c === '[') ++square;
		else if(c === ']') --square;
		else if(c === '{') ++curly;
		else if(c === '}') --curly;
		else if(c === '(') ++round;
		else if(c === ')') --round;
		else if(c === '<') ++angle;
		else if(c === '>') --angle;

		if(c === char && square === 0 && curly === 0 && round === 0 && angle === 0){
			return i;
		}
	}
	
	if(square !== 0) _.errout('mismatched [] brackets: ' + str);
	if(curly !== 0) _.errout('mismatched {} brackets: ' + str);
	if(round !== 0) _.errout('mismatched () brackets: ' + str);
	
	return -1;
}

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

	return res;
}

function subIndex(i, ei){
	if(i === -1) return ei;
	if(ei !== -1 && ei < i) return ei;
	return i;
}

var alphaRegex = /^[0-9A-Za-z]+$/;
function checkAlphanumericOnly(str, msg){
	if(str.charAt(0) === '~') return;
	//if(str === '$') return;
	if(!alphaRegex.test(str)){
		_.errout(msg);
	}
}

function parseViewExpr(expr){
	var path = [];
	
	while(expr.length > 0){
		var fc = expr.charAt(0);
		var openRound = findOuterChar(expr, '(')
		var closeRound = findOuterChar(expr, ')')

		var openCurly = findOuterChar(expr, '{')
		var closeCurly = findOuterChar(expr, '}')
		
		var openAngle = findOuterChar(expr, '<')
		var closeAngle = findOuterChar(expr, '>')

		if(fc === "'"){
			var str = expr.substring(1, expr.length-1);
			path.push({type: 'value', value: str, schemaType: {type: 'primitive', primitive: 'string'}});
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
			
			path.push({type: 'view', view: 'typeset', params: [{type: 'value', value: typeName}]});
			
		}else if(fc === '.'){
			var end = expr.indexOf('[');
			var doti = expr.indexOf('.', 1);
			if(end === -1) end = expr.indexOf(' ');
			if(end === -1) end = expr.indexOf('{');
			if(end === -1) end = expr.length;
			if(doti !== -1 && doti < end) end = doti;
			var dotc = expr.indexOf('{');
			if(dotc !== -1 && dotc < end) end = dotc;
			path.push({type: 'view', view: 'property', params: [{type: 'value', value: expr.substring(1, end)}]});
			expr = expr.substr(end);
		}else if(openRound !== -1 && openCurly === -1){
			var viewName = expr.substr(0, openRound).trim();
			var paramStr = expr.substring(openRound+1, expr.lastIndexOf(')'));
			var paramStrs = safeSplit(paramStr, ',');

			var params = [];
			_.each(paramStrs, function(ps){
				params.push(parseViewExpr(ps.trim()));
			});
			var viewExpr = {type: 'view', params: params, view: viewName}
			while(sugar[viewName]){
				var newViewExpr = sugar[viewName].transform(viewExpr)
				_.assertDefined(newViewExpr)
				viewExpr = newViewExpr
				if(viewExpr.type !== 'view') break;
				viewName = viewExpr.view
			}
			path.push(viewExpr);
			expr = expr.substr(expr.lastIndexOf(')')+1);
		}else if(openRound !== -1 && openCurly !== -1){

			var viewEndIndex = closeRound
			var paramStr = expr.substring(openRound+1, viewEndIndex);

			var paramStrs = safeSplit(paramStr, ',');

			var params = [];
			_.each(paramStrs, function(ps){
				var pp = ps.split(' ')
				params.push(pp[0].trim());
			});
			
			var bodyStr = expr.substring(openCurly+1, closeCurly)
			var body = parseViewExpr(bodyStr)
			path.push({type: 'macro', params: params, expr: body})
			expr = expr.substr(closeCurly+1)

		}else if(openCurly === 0){
			var bodyStr = expr.substring(openCurly+1, closeCurly)
			var body = parseViewExpr(bodyStr)
			path.push({type: 'macro', params: 'unspecified', view: viewName, expr: body})
			expr = expr.substr(closeCurly+1)
		}else if(openAngle !== -1){
			var globalMacroName = expr.substr(0, openAngle)
			var bindingStrs = safeSplit(expr.substring(openAngle+1, closeAngle), ',')
			var bindingParams = [];
			_.each(bindingStrs, function(ps){
				bindingParams.push(parseViewExpr(ps.trim()));
			});
			path.push({type: 'partial-application', macro: globalMacroName, params: bindingParams})
			expr = expr.substr(closeAngle+1)
		}else if(expr.indexOf(':') !== -1){
			var typeName = expr.substr(0, expr.indexOf(':')).trim()
			expr = expr.substr(expr.indexOf(':')+1)
			var strExpr = {type: 'value', value: typeName, schemaType: {type: 'primitive', primitive: 'string'}}
			var paramExpr = expr
			if(paramExpr.indexOf('.') !== -1) paramExpr = paramExpr.substr(0, paramExpr.indexOf('.'))
			expr = expr.substr(paramExpr.length)
			var pve = parseViewExpr(paramExpr)
			//_.assertDefined(typeName)
			if(typeName === 'undefined') _.errout('here')
			pve.schemaType = {type: 'object', object: typeName}
			path.push({type: 'view', view: 'cast', params: [strExpr, pve]})
			//break;
		}else{
			var dotIndex = findOuterChar(expr, '.')
			if(dotIndex !== -1){
				var firstPart = expr.substr(0, expr.indexOf('.'));
				firstPart = firstPart.trim();
				checkAlphanumericOnly(firstPart, 'parameter name must contain only alphanumeric characters, or be & or $ (' + firstPart + ')');
				path.push({type: 'param', name: firstPart});
				expr = expr.substr(expr.indexOf('.'));
			}else{
				expr = expr.trim();
				if(parseInt(expr)+'' === expr){
					path.push({type: 'int', value: parseInt(expr)})
					break;
				}/*else if(expr.indexOf(':') !== -1){
					var typeName = expr.substr(0, expr.indexOf(':')).trim()
					expr = expr.substr(expr.indexOf(':')+1)
					var strExpr = {type: 'value', value: typeName, schemaType: {type: 'primitive', primitive: 'string'}}
					var pve = parseViewExpr(expr)
					//_.assertDefined(typeName)
					if(typeName === 'undefined') _.errout('here')
					pve.schemaType = {type: 'object', object: typeName}
					path.push({type: 'view', view: 'cast', params: [strExpr, pve]})
					break;
				}*/else if(expr === '[]'){
					path.push({type: 'array', value: []})
					break;
				}else if(expr === 'false' || expr === 'true'){
					path.push({type: 'value', value: expr === 'true'})
					break;
				}else{
					checkAlphanumericOnly(expr, 'parameter name must contain only alphanumeric characters, or be & or $ (' + expr + ')');
					path.push({type: 'param', name: expr});
					break;
				}
			}
		}
		expr = expr.trim()
	}
	//console.log('path: ' + JSON.stringify(path))
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
		//console.log('LAST: ' + JSON.stringify(last))
		_.assertArray(last.params)
		last.params.push(invertViewExpression(rest))
		e = last;
	}
	
	return e;
}

function computePathResultType(path, baseType, context, schema, viewMap){
	_.assertLength(arguments, 5);
	_.assertObject(baseType);
	var t = baseType;
	_.each(path, function(p){
		if(p.type === 'property'){
			_.errout('TODO?')
			t = t.properties[p.property];
			if(t === undefined){
				_.errout('unknown property: ' + p.property);
			}
			_.assertObject(t);
		}else if(p.type === 'macro'){
			_.errout('TODO?')
			var input = t;
			t = computeType(p.expr, context, schema, viewMap);
			if(input.type.type === 'set'){
				t = {type: 'set', members: t};
			}else if(input.type.type === 'list'){
				t = {type: 'list', members: t};
			}
			_.assertObject(t);
		}else{
			_.errout('TODO support path part type: ' + p.type);
		}
	});
	return t;
}

function computeParamTypes(rel, bindingTypes, implicits, computeTypeWrapper){
	_.assertLength(arguments, 4)
	_.assertArray(implicits)
	rel.params.forEach(function(p){
		if(p.type === 'macro' || p.type === 'partial-application'){
			return
		}
		computeTypeWrapper(p, bindingTypes, implicits)
	})
}
function computeMacroType(schema, computeType, viewMap, macroParam, bindingTypes, newBindingTypes, implicits){
	var valueType;
	if(macroParam.type === 'macro'){
		var nbt = {}
		_.extend(nbt, bindingTypes, newBindingTypes)
		valueType = computeType(macroParam.expr, nbt, macroParam.implicits)
		_.assertDefined(valueType)
		macroParam.schemaType = valueType
	}else if(macroParam.type === 'view'){
		if(builtinFunctions[macroParam.view] !== undefined){
			var def = builtinFunctions[macroParam.view]
			var ch = {
				computeType: computeType,
				computeMacroType: computeMacroType.bind(undefined, schema, computeType, viewMap),
				schema: schema,
				viewMap: viewMap,
				bindingTypes: bindingTypes
			}
			def.schemaType(macroParam, ch)
			_.assertDefined(macroParam.schemaType)
		}else{
			_.errout('TODO: ' + JSON.stringify(macroParam))
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(macroParam))
	}
	return valueType;
}
function computeType(rel, v, schema, viewMap, bindingTypes, implicits, synchronousPlugins){
	_.assertLength(arguments, 7);
	_.assertArray(implicits)
	_.assertObject(rel);

	function computeTypeWrapper(relValue, bindingTypes, localImplicits){
		_.assertDefined(relValue)
		_.assertObject(bindingTypes)
		_.assertArray(localImplicits)
		return computeType(relValue, v, schema, viewMap, bindingTypes, localImplicits || implicits, synchronousPlugins)
	}
	
	if(rel.type === 'param' && bindingTypes[rel.name] !== undefined){
		if(bindingTypes[rel.name].type.type === 'object' && bindingTypes[rel.name].type.object === 'macro') throw new Error()
		_.assertDefined(bindingTypes[rel.name])
		return rel.schemaType = bindingTypes[rel.name]
	}else if(rel.type === 'param'){
		if(rel.name === undefined){
			_.errout('error: ' + JSON.stringify(rel))
		}
		if(rel.name.charAt(0) === '~'){
			
			var num = rel.name.length > 1 ? parseInt(rel.name.substr(1)) : 1
			--num
			_.assertDefined(bindingTypes[implicits[num]])
			return rel.schemaType = bindingTypes[implicits[num]]
		}
		
		 var vv = _.detect(v.params, function(p){
			if(p.name === rel.name) return true;
		})
		if(vv === undefined){
			console.log('param: ' + JSON.stringify(rel))
			console.log('binding names: ' + JSON.stringify(Object.keys(bindingTypes)))
			console.log('bindings: ' + JSON.stringify(bindingTypes))
			_.errout('cannot find param: ' + rel.name + ' (' + JSON.stringify(v.params) + ')');
		}
		_.assertObject(vv.type);
		return rel.schemaType = vv.type;
	}else if(rel.type === 'param-path'){
		var initialTypeName = _.detect(v.params, function(p){
			if(p.name === rel.path[0].name) return true;
		}).type;
		if(initialTypeName === undefined){
			_.errout('parameter not found: ' + rel.path[0].name);
		}
		var initialType = schema[initialTypeName.object];
		if(initialType === undefined){
			_.errout('object type not found: ' + JSON.stringify(initialTypeName));
		}
		rel.schemaType = computePathResultType(rel.path.slice(1), initialType, v, schema, viewMap);
		_.assertDefined(rel.schemaType)
		return rel.schemaType
	}else if(rel.type === 'view'){
	
		_.assertString(rel.view)
		
		if(rel.view === 'cast'){
			//_.assertString(rel.typeName)
			_.assertDefined(rel.params[0].value)
			if(rel.params[0].value.name === 'undefined') _.errout('here')
			computeParamTypes(rel, bindingTypes, implicits, computeTypeWrapper)
			return rel.schemaType = {type: 'object', object: rel.params[0].value}
		}
		if(rel.view === 'case'){
			rel.schemaType = computeTypeWrapper(rel.params[1], bindingTypes, implicits)
			_.assertDefined(rel.schemaType)

			return rel.schemaType
		}
		
		var v = viewMap[rel.view];

		var ch = {
			computeType: computeTypeWrapper,
			computeMacroType: computeMacroType.bind(undefined, schema, computeTypeWrapper, viewMap),
			schema: schema,
			viewMap: viewMap,
			bindingTypes: bindingTypes
		}
		
		if(v){//view is creating a view object
			computeParamTypes(rel, bindingTypes, implicits, computeTypeWrapper)
			return rel.schemaType = {type: 'view', view: rel.view}
		}
		
		if(bindingTypes[rel.view] !== undefined){//view is calling a macro in a parameter
			_.assertLength(rel.params, 0)
			computeParamTypes(rel, bindingTypes, implicits, computeTypeWrapper)
			return bindingTypes[rel.view].schemaType//TODO should be setting rel.schemaType here?
		}
		
		if(schema[rel.view]){
			computeParamTypes(rel, bindingTypes, implicits, computeTypeWrapper)
			if(rel.view === 'undefined') _.errout('here')
			rel.schemaType = {type: 'object', object: rel.view, code: schema[rel.view].code};
			_.assertDefined(rel.schemaType)
			return rel.schemaType
		}
		
		var def = builtinFunctions[rel.view]
		
		if(def === undefined){
			def = synchronousPlugins[rel.view]
		}
		
		if(def === undefined){
			log(JSON.stringify(Object.keys(schema)))
			log(JSON.stringify(bindingTypes))
			throw new Error('cannot find: ' + rel.view)
		}
		
		v = {}
		
		if(rel.params.length < def.minParams) throw new Error(def.callSyntax + ' called with ' + rel.params.length + ' params.')
		_.assert(def !== undefined)
		computeParamTypes(rel, bindingTypes, implicits, computeTypeWrapper)
		var res = def.schemaType(rel, ch)
		rel.params.forEach(function(p){
			if(p.type === 'macro' || p.type === 'partial-application'){//must be computed by def.schemaType
				if(p.schemaType === undefined) throw new Error('def.schemaType ' + rel.view + ' did not compute macro schemaType')
			}else{
				if(p.schemaType === undefined) throw new Error('failed to compute schemaType for rel: ' + JSON.stringify(p))
			}
		})
		_.assertObject(res)
		return rel.schemaType = res;
		
	}else if(rel.type === 'typeset'){
		var t = schema[rel.name];
		if(t === undefined){
			_.errout('unknown type: ' + rel.name);
		}
		
		//TODO: detect when a list or singleton is the destination type
		var res = computePathResultType(rel.path, t, v, schema, viewMap);
		
		_.assertObject(res);
		_.assertString(res.name)
		if(res.name === 'undefined') _.errout('here')
		return rel.schemaType = {type:'set', members: {type: 'object', object: res.name, objectCode: res.code}};//code: res.code, hintName: res.name}};
	}else if(rel.type === 'value'){
		if(_.isString(rel.value)) return rel.schemaType = {type: 'primitive', primitive: 'string'}
		else if(_.isInt(rel.value)) return rel.schemaType = {type: 'primitive', primitive: 'int'}
		else if(_.isNumber(rel.value)) return rel.schemaType = {type: 'primitive', primitive: 'real'}
		else if(rel.value === false || rel.value === true) return rel.schemaType = {type: 'primitive', primitive: 'boolean'}
		else{
			_.errout('TODO: ' + JSON.stringify(rel))
		}
	}else if(rel.type === 'macro'){//macro is the inline form (alternate types: global-macro, bound-macro)
		_.errout('never happens')
		//return rel.schemaType = computeType(rel.expr, v, schema, viewMap, bindingTypes)
	}else if(rel.type === 'partial-application'){
		_.errout('Cannot compute type of partial-application directly')
	}else if(rel.type === 'concrete-specialization'){
		_.errout('TODO?')
		/*
		//TODO compute base union of return types of all cases
		var types = []
		//TODO specialize binding types depending on the original global-macro signature
		rel.cases.forEach(function(c){
			var newBindingTypes = {}

			_.each(bindingTypes, function(t, key){
				newBindingTypes[key] = t
				if(c.signature[key]){
					newBindingTypes[key] = c.signature[key]
					console.log('specialization mapped type ' + JSON.stringify(t) + ' to ' + JSON.stringify(c.signature[key]));
				}
				console.log('signature(' + key + '): ' + JSON.stringify(c.signature))
			})
			
			implicits.forEach(function(impKey, index){
				var t = bindingTypes[impKey];
				if(t !== undefined){
					newBindingTypes[impKey] = t
					if(c.signature.length > index){
						newBindingTypes[impKey] = c.signature[index].type;
					}
				}
			})

			console.log('binding types: ' + JSON.stringify(newBindingTypes))
			console.log('implicits: ' + JSON.stringify(implicits))
			var st = computeTypeWrapper(c.expr, newBindingTypes, implicits)
			types.push(st)
		})
		console.log(JSON.stringify(types))
		var temp = JSON.stringify(types[0])
		for(var i=1;i<types.length;++i){
			var t = JSON.stringify(types[i])
			if(temp !== t){
				_.errout('TODO implement type base computation')
			}
		}
		return types[0]*/
	}else if(rel.type === 'int'){
		return rel.schemaType = {type: 'primitive', primitive: 'int'}
	}else if(rel.type === 'array'){
		return rel.schemaType = {type: 'set', members: {type: 'primitive', primitive: 'string'}}
	}else{
		_.errout('TODO: support rel type: ' + rel.type);
	}
}

function makeViewSchema(v, schema, result, viewMap, synchronousPlugins){
	_.assertLength(arguments, 5)
	
	result.superTypes = {readonly: true, recursively_readonly: true};
	result.name = v.name
	_.assertString(v.name)
	var bindingTypes = {}
	v.params.forEach(function(p){
		bindingTypes[p.name] = p.type;
	})

	if(_.size(v.rels) > 0){
		result.properties = {};
		result.propertiesByCode = {};
	}
	
	_.each(v.rels, function(rel, name){
		var p = result.properties[name] = {};
		p.name = name;
		p.type = computeType(rel, v, schema, viewMap, bindingTypes, [], synchronousPlugins);
		_.assertInt(rel.code);
		p.code = rel.code;
		p.tags = {};
		_.assertNumber(p.code);
		result.propertiesByCode[p.code] = p;
	});
	
	return result;
}

function isMacro(v){
	return findOuterChar(v.tokens[0], '{') !== -1
}
function isSpecialization(v){
	return v.string.indexOf(':=') !== -1;
}
function parseParams(paramsStr){
	var paramStrings;
	if(paramsStr.trim().length > 0){
		paramStrings = paramsStr.split(',');
	}else{
		paramStrings = [];
	}
	var params = _.map(paramStrings, function(p, index){
		var sp = p.trim().split(' ');

		if(reservedTypeNames.indexOf(sp[0]) !== -1) _.errout('using reserved name: ' + sp[0]);
		if(sp.length === 1){
			//return {name: sp[0], index: index};
			throw new Error('you must specify a type for this parameter: ' + sp[0]);
		}else{
			var t = {type: keratin.parseType(sp[1]), name: sp[0], index: index};
			if(t.type.object === 'macro'){
				t.type = {type: 'macro'}
			}
			return t
		}
	});
	return params
}
function viewMinnowize(schemaDirs, view, schema, synchronousPlugins){
	_.assertLength(arguments, 4);
	_.assertObject(schema);

	//console.log(new Error().stack)

	var takenCodes = {};
	_.each(schema._byCode, function(value, typeCodeStr){
		_.assertInt(value.code);
		takenCodes[value.code] = true;
	});
	
	var result = {};
	
	function processView(v, viewName){
		if(isSpecialization(v)){
			//_.errout('TODO')
			var name = v.string.substr(0, v.string.indexOf(':='))
			name = name.trim()
			var casesStr = v.string.substr(v.string.indexOf(':=')+2)
			var caseNames = casesStr.split(',')
			for(var i=0;i<caseNames.length;++i){
				caseNames[i] = caseNames[i].trim()
			}
			result[name] = {type: 'specialization', cases: caseNames, name: name};
		}else if(isMacro(v)){
			var expr = v.tokens[0]
			_.assertString(expr)
			expr = expr.replace(/\n/gi, '')
			var name = expr.substr(0, expr.indexOf('('))
			var paramsStr = expr.substring(expr.indexOf('(')+1, expr.indexOf(')'))
			var body = expr.substring(expr.indexOf('{')+1, expr.lastIndexOf('}'))
			var params = parseParams(paramsStr)
			var bodyExpr = parseViewExpr(body)
			_.assertObject(bodyExpr)
			result[name] = {type: 'global-macro', expr: bodyExpr, params: params, name: name};
		}else{
			var expr = v.tokens[0];
			var obi = expr.indexOf('(')
			if(obi === -1) return;//skip non-views (objects)
			var cbi = expr.indexOf(')')
			var name = expr.substr(0, obi);
			if(reservedTypeNames.indexOf(name) !== -1) _.errout('using reserved name: ' + name);
			var paramsStr = expr.substring(obi+1, cbi);
			var params = parseParams(paramsStr)
			var code = parseInt(v.tokens[1]);
			if(takenCodes[code]){
				_.errout('view ' + name + ' is using a code that is already taken: ' + code);
			}
			takenCodes[code] = true;
			var vn = {name: name, params: params, paramsByName: {}, rels: {}, code: code, superTypes: {}};
			if(result[name]) _.errout('duplicate view name "' + name + '"')
			result[name] = vn;
		
			_.each(params, function(p){
				vn.paramsByName[p.name] = p;
			});
		
			var relTakenCodes = {};
			_.each(v.children, function(r){
			
				if(r.tokens.length < 3) _.errout('view rels must have the syntax: <name> <expression> <code>\n' + JSON.stringify(r));
			
				var rName = r.tokens[0];
				var rExpr = r.tokens[1];
				if(vn.rels[rName]) _.errout('duplicate property name "' + rName + '" for ' + viewName)
				vn.rels[rName] = parseViewExpr(rExpr);
				
				var cc = parseInt(r.tokens[2]);
				if(!_.isInt(cc)) _.errout('rel code must be an integer: ' + JSON.stringify(r));
				_.assertInt(cc);
				if(relTakenCodes[cc]){
					_.errout('view rel ' + rName + ' is using a code that is already taken: ' + cc);
				}
				relTakenCodes[cc] = true;
				_.assertInt(cc);
				
				vn.rels[rName].code = cc;
			});
			vn.schema = {};
		}
	}
	_.each(view.children, function(v){
		try{
			processView(v, v.tokens[0])
		}catch(e){
			console.log(e)
			console.log('...while processing ' + v.tokens[0])
			throw new Error('minnow syntax error');
		}
	});
	
	concretizeMacros(result)//inline all global macros and partial applications, converting them into 'macros'
	
	computeBindingsUsedByMacros(result)//we can deduplicate variables better if we know that a binding isn't actually used
	
	var vsStr = '';
	
	//we do this separately to resolve circular dependencies
	_.each(result, function(vn, name){
		if(vn.schema){
			//console.log('computing schema for ' + name)
			makeViewSchema(vn, schema, vn.schema, result, synchronousPlugins);
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
		}else{
			//console.log('not computing schema for: ' + name)
		}
	});
	//console.log('wrote generated: ' + schemaDirs[0] + '/view.schema.generated')
	fs.writeFile(schemaDirs[0] + '/view.schema.generated', vsStr, 'utf8');
	
	return result;
}

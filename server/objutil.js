
var _ = require('underscorem');

function findPropertyValue(propertyCode, obj){
	/*for(var i=0;i<obj.length;++i){
		var entry = obj[i];
		if(entry[0] === propertyCode){
			return entry[1];
		}
	}*/
	return obj[propertyCode];
}

function selectPathOnObject(schema, sc, obj, path){
	if(path.length === 0) return obj;
	
	_.assertObject(sc);
	_.assert(path.length >= 1);
	var i=0;
	var p = path[0];
	var psc = sc.propertiesByCode[p];
	if(psc === undefined) _.errout('cannot find property by code ' + p + ' for type: ' + JSON.stringify(sc));
	
	var sub = obj[p];
	/*for(var j=0;j<obj.length;++j){
		if(p === obj[j][0]){
			sub = obj[j][1];
			break;
		}
	}*/
	
	if(sub === undefined){
		_.errout('path error, property code not found: ' + p + 
			' (out of ' + JSON.stringify(_.keys(sc.properties)) + ' for ' + sc.name + ')');
	}
	
	if(path.length > 1){
		return selectPathOnProperty(schema, psc, sub, path.slice(1));
	}
	return sub;
}

function selectPathOnProperty(schema, sc, cur, path){
	if(path.length === 0) return cur;
	
	//console.log(JSON.stringify(sc));
	if(sc.type.type === 'set'){
		_.assert(path.length >= 2);
		var typeCode = path[0];
		var id = path[1];
		var arr = cur[typeCode];
		var sub;
		if(arr){
			for(var j=0;j<arr.length;++j){

				var e = arr[j];
				if(_.isArray(e)){
					if(id === e[0][2]){
						sub = e[1];
						/*
						if(cur === undefined){
							e.push([]);
							sub = e[1];
						}*/
						break;
					}
				}else{
					if(id === e){
						_.errout('TODO support descent into top-level object');
					}
				}
			}
		}
		if(sub === undefined){
			console.log('searched: ' + JSON.stringify(cur));
			_.errout('path error, id not found: ' + id);
		}
		
		if(path.length === 2) return sub;
		
		if(sc.type.members.type === 'object'){
			return selectPathOnObject(schema, schema._byCode[typeCode], cur, path.slice(2));
		}else{
			_.errout('TODO primitive sets');
		}
		
	}else if(sc.type.type.indexOf('list') === 0){
		_.assert(path.length >= 2);
		var typeCode = path[0];
		var id = path[1];
		var sub;
		for(var j=0;j<cur.length;++j){

			var e = cur[j];
			//console.log('e: ' + JSON.stringify(e));
			if(_.isArray(e[1])){
				
				if(typeCode === e[0] && id === e[1][0][2]){
					sub = e[1];
					/*if(cur === undefined){
						e.push([]);
						//console.log('pushing list entry: ' + JSON.stringify(cur));
						sub = e[1];
					}*/
					break;
				}
			}else{
				if(typeCode === e[0] && id === e[1]){
					_.errout('TODO support descent into top-level object');
				}
			}
		}
		if(sub === undefined){
			//console.log('searched: ' + JSON.stringify(cur));
			_.errout('*path error, id not found: ' + id);
		}
		
		if(path.length === 2) return sub;
		
		if(sc.type.members.type === 'object'){
			return selectPathOnObject(schema, schema._byCode[typeCode], sub, path.slice(2));
		}else{
			_.errout('TODO primitive lists');
		}
	}else if(sc.type.type === 'map'){
		var key = path[0];
		for(var i=0;i<cur.length;++i){
			var e = cur[i];
			if(e[0] === key){
				//console.log(JSON.stringify(sc.members));
				return selectPathOnObject(schema, sc.members, e[1], path.slice(1));
				break;
			}
		}
		_.errout('path error, key not found: ' + key);
	}else if(sc.type.type === 'object'){
		_.assert(path.length >= 1);
		var typeCode = path[0];
		var sc = schema._byCode[typeCode];
		_.assertObject(sc);
		if(path.length > 1){
			return selectPathOnObject(schema, sc, cur, path.slice(1));
		}else{
			return cur;
		}
	}else{
		_.errout('TODO: ' + sc.type.type);
	}
}

//TODO build and cache functions for descent based on schema with branchings at object->property
function descendObject(schema, typeCode, obj, descentPath){
	if(descentPath.length === 0) return obj;
	var pc = descentPath[0];
	var cur = findPropertyValue(pc, obj);
	return selectPathOnProperty(schema, schema._byCode[typeCode].propertiesByCode[pc], cur, descentPath.slice(1));
}


exports.findPropertyValue = findPropertyValue;
exports.descendObject = descendObject;

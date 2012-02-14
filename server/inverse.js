"use strict";

/*

inverse.js always will reply to requests for a given (typeCode, id) in the order they arrive (even if they require async lookups.)

----

The index format looks like:

type->id->propertyType[->key]->type->id

The ->key part only exists if the property type is a map

pretty much every step of that sequence is one->many, except the propertyType->, which *may* be one->one, and the ->key, which *must* be one->one

----

Once DF is implemented, inverse.js may also cache results.

*/
exports.make = function(ap){

	return {
		//the path part will be [propertyType] or [propertyType, key].
		//cb([[typeCode, id, [path]], [typeCode, id, [path]]...])
		getInverse: function(typeCode, id, cb){
			var invArr = ap.getInverse(typeCode, id);
			//Note: for now, invArr will only include 'positive' results - however
			//once we have the DF it may also include 'negative' results - information about which
			//inverse relationships exist in the DFs but were removed since.
			
			var res = [];
			
			console.log('inverse(' + typeCode + ' ' + id + '): ' + invArr.length);
			
			for(var i=0;i<invArr.length;++i){
				var e = invArr[i];
				if(e[0] === true){
					res.push(e[1]);
				}else{
					_.errout('TODO');
				}
			}
			
			cb(res);
		},
		
	};
}


var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var keys = Object.keys(editCodes)
var codes = []
for(var i=0;i<keys.length;++i){
	codes.push(editCodes[keys[i]])
}
var m = {
	names: keys,
	codes : codes
}
require('fs').writeFileSync(__dirname+'/../http/js/editlookup.json', JSON.stringify(m))

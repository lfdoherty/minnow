
//var editFp = require('./tcp_shared').editFp

var fs = require('fs')
var keratin = require('keratin')

var reservedTypeNames = ['type']

var editSchemaStr = fs.readFileSync(__dirname + '/edits.baleen', 'utf8')
var editSchema = keratin.parse(editSchemaStr, reservedTypeNames)

var editCodes = {}//editFp.codes
var editNames = {}//editFp.names

Object.keys(editSchema._byCode).forEach(function(key){
	var edit = editSchema._byCode[key]
	editCodes[edit.name] = edit.code
	editNames[edit.code] = edit.name
})

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

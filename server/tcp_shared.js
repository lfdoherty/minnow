var fs = require('fs')

var keratin = require('keratin')
var baleen = require('baleen')

var editSchemaStr = fs.readFileSync(__dirname + '/edits.baleen', 'utf8')
var editSchema = keratin.parse(editSchemaStr, baleen.reservedTypeNames)
var clientSchemaStr = fs.readFileSync(__dirname + '/client.baleen', 'utf8')
var clientSchema = keratin.parse(clientSchemaStr, baleen.reservedTypeNames)
var responsesSchemaStr = fs.readFileSync(__dirname + '/responses.baleen', 'utf8')
var responsesSchema = keratin.parse(responsesSchemaStr, baleen.reservedTypeNames)

function makeExes(appSchema){

	var appEx = baleen.makeFromSchema(appSchema, undefined, true, true);
	var editEx = baleen.makeFromSchema(editSchema, appEx);
	var clientEx = baleen.makeFromSchema(clientSchema, editEx);
	var responsesEx = baleen.makeFromSchema(responsesSchema, editEx);
	
	//console.log('clientEx: ' + clientSchemaStr)
	return {
		app: appEx,
		edit: editEx,
		client: clientEx,
		responses: responsesEx
	}
}

exports.makeExes = makeExes;

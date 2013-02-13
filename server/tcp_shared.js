//"use strict";

var fparse = require('fparse')


var fs = require('fs')

var _ = require('underscorem')

var keratin = require('keratin')

var reservedTypeNames = ['type']

var editSchemaStr = fs.readFileSync(__dirname + '/edits.baleen', 'utf8')
var editSchema = keratin.parse(editSchemaStr, reservedTypeNames)
var clientSchemaStr = fs.readFileSync(__dirname + '/client.baleen', 'utf8')
var clientSchema = keratin.parse(clientSchemaStr, reservedTypeNames)
var responsesSchemaStr = fs.readFileSync(__dirname + '/responses.baleen', 'utf8')
var responsesSchema = keratin.parse(responsesSchemaStr, reservedTypeNames)

var fparse = require('fparse')

var editFp = fparse.makeFromSchema(editSchema)

var log = require('quicklog').make('minnow/tcp_shared')

exports.clientSchema = clientSchema
exports.responsesSchema = responsesSchema
exports.editSchema = editSchema
exports.editFp = editFp

exports.clientRequests = fparse.makeFromSchema(clientSchema)
exports.serverResponses = fparse.makeFromSchema(responsesSchema)

var lookup = require('./../http/js/lookup')

Object.keys(lookup).forEach(function(key){
	editFp[key] = lookup[key]
})


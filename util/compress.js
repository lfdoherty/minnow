"use strict";

var lzo = require('mini-lzo-wrapper');


function compressBlock(snapBuffer){

	var compBufferSize = 4+(Math.ceil(snapBuffer.length * 1.1) + 50);//the creator of LZO says 106% is the maximum he's ever seen - so 110% plus 50 bytes should be enough.
				
	var comp = new Buffer(compBufferSize);
	var len = lzo.compress(snapBuffer, 0, snapBuffer.length, comp, 4);
	
	bin.writeInt(comp, 0, snapBuffer.length);
	return comp.slice(0, len+4);
}

function decompressBlock(dataBuffer){

	var uncompressedSize = bin.readInt(dataBuffer, 0);

	var decomp = new Buffer(uncompressedSize);
	lzo.decompress(dataBuffer, 4, dataBuffer.length-4, decomp, 0);

	return decomp;
}

function decompressBlockUsingTemporary(dataBuffer, temporaryBuffer){

	var uncompressedSize = bin.readInt(dataBuffer, 0);

	if(temporaryBuffer.length < uncompressedSize) _.errout('error, temporary buffer too small: ' + temporaryBuffer.length + ' < ' + uncompressedSize);

	lzo.decompress(dataBuffer, 4, dataBuffer.length-4, temporaryBuffer, 0);

	return uncompressedSize;
}

function decompressBlockUsingTemporaryWithOffsets(dataBuffer, off, len, temporaryBuffer){

	var uncompressedSize = bin.readInt(dataBuffer, 0);

	if(temporaryBuffer.length < uncompressedSize) _.errout('error, temporary buffer too small: ' + temporaryBuffer.length + ' < ' + uncompressedSize);

	lzo.decompress(dataBuffer, off+4, len-4, temporaryBuffer, 0);

	return uncompressedSize;
}
exports.compressBlock = compressBlock;
exports.decompressBlock = decompressBlock;
exports.decompressBlockUsingTemporary = decompressBlockUsingTemporary;
exports.decompressBlockUsingTemporaryWithOffsets = decompressBlockUsingTemporaryWithOffsets;

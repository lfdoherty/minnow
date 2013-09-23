
exports.arrayToString = arrayToString
exports.stringToArray = stringToArray
exports.bufferToString = bufferToString
exports.stringToBuffer = stringToBuffer

function arrayToString(buf){
	var arr = new Uint16Array(buf)
	var str = ''
	for(var i=0;i<arr.length;++i){
		str += String.fromCharCode(arr[i])
	}
	return str
}

function stringToArray(str){
	var buf = new ArrayBuffer(str.length*2);//2 bytes for each char
	var bufView = new Uint16Array(buf);
	for (var i=0, strLen=str.length; i<strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}

function bufferToString(buf){
	var len = buf.length
	var str = ''
	for(var i=0;i<buf.length;i+=2){
		str += String.fromCharCode(
			buf[i]|
			((buf[i]>>8)&0xFF)
		)
	}
	return str
}

function stringToBuffer(str){
	var len = str.length
	var buf = new Buffer(len*2)
	var j=0
	for(var i=0;i<len;++i){
		var c = str.charCodeAt(j)
		buf[j++] = c&0xFF
		buf[j++] = (c>>8)&0xFF
	}
	return buf;
}


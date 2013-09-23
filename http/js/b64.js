
var base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=";
var charToByte = {}
for(var i=0;i<base64Chars.length;++i){
	charToByte[base64Chars[i]] = i
}

exports.encode = encode
exports.decode = decode
exports.encodeBuffer = encodeBuffer
exports.decodeBuffer = decodeBuffer

function encode(str){
	var newStr = ''
	for(var i=0;i<str.length;i+=3){
	
		if(i+1 >= str.length){
			var c1 = str.charCodeAt(i)
			newStr += base64Chars[c1&0x3F]
			newStr += base64Chars[(c1>>6)&0x3F]
			newStr += base64Chars[((c1>>12)&0x0F)]
		}else if(i+2 >= str.length){
			var c1 = str.charCodeAt(i)
			var c2 = str.charCodeAt(i+1)
			newStr += base64Chars[c1&0x3F]
			newStr += base64Chars[(c1>>6)&0x3F]
			newStr += base64Chars[((c1>>12)&0x0F)|((c2&0x03)<<4)]
			newStr += base64Chars[((c2>>2)&0x3F)]
			newStr += base64Chars[((c2>>8)&0x3F)]
			newStr += base64Chars[((c2>>14)&0x03)]
		}else{
			var c1 = str.charCodeAt(i)
			var c2 = str.charCodeAt(i+1)
			var c3 = str.charCodeAt(i+2)
			newStr += base64Chars[c1&0x3F]
			newStr += base64Chars[(c1>>6)&0x3F]
			newStr += base64Chars[((c1>>12)&0x0F)|((c2&0x03)<<4)]
			newStr += base64Chars[((c2>>2)&0x3F)]
			newStr += base64Chars[((c2>>8)&0x3F)]
			newStr += base64Chars[((c2>>14)&0x03)|((c3&0x0F)<<2)]
			newStr += base64Chars[((c3>>4)&0x3F)]
			newStr += base64Chars[((c3>>10)&0x3F)]
		}
	}
	return newStr
}


function decode(str){
	var newStr = ''
	var i=0
	while(i < str.length){
		if(i+3 >= str.length){
			var b1 = charToByte[str[i++]]
			var b2 = charToByte[str[i++]]
			var b3 = charToByte[str[i++]]
			
			newStr += String.fromCharCode(
				b1|(b2<<6)|((b3&0x0F)<<12)
			)
		}else if(i+6 >= str.length){
			var b1 = charToByte[str[i++]]
			var b2 = charToByte[str[i++]]
			var b3 = charToByte[str[i++]]
			var b4 = charToByte[str[i++]]
			var b5 = charToByte[str[i++]]
			var b6 = charToByte[str[i++]]
			
			newStr += String.fromCharCode(
				b1|(b2<<6)|((b3&0x0F)<<12),
				((b3>>4)&0x03)|(b4<<2)|(b5<<8)|((b6&0x03)<<14)
			)
		}else{//8 chars
			var b1 = charToByte[str[i++]]
			var b2 = charToByte[str[i++]]
			var b3 = charToByte[str[i++]]
			var b4 = charToByte[str[i++]]
			var b5 = charToByte[str[i++]]
			var b6 = charToByte[str[i++]]
			var b7 = charToByte[str[i++]]
			var b8 = charToByte[str[i++]]
			
			newStr += String.fromCharCode(
				b1|(b2<<6)|((b3&0x0F)<<12),
				((b3>>4)&0x03)|(b4<<2)|(b5<<8)|((b6&0x03)<<14),
				((b6>>2)&0x0F)|(b7<<4)|(b8<<10)
			)
		}		
	}
	//console.log('decoded: ' + str + '->' + newStr.length)
	return newStr
}

function encodeBuffer(buf){
	var newStr = ''
	for(var i=0;i<buf.length;i+=3){
		if(i+1 >= buf.length){
			var b1 = buf[i]
			newStr += base64Chars[b1&0x3F]
			newStr += base64Chars[((b1>>6)&0x03)]
		}else if(i+2 >= buf.length){
			var b1 = buf[i]
			var b2 = buf[i+1]
			newStr += base64Chars[b1&0x3F]
			newStr += base64Chars[((b1>>6)&0x03)|((b2&0x0F)<<2)]
			newStr += base64Chars[((b2>>4)&0x0F)]
		}else{
			var b1 = buf[i]
			var b2 = buf[i+1]
			var b3 = buf[i+2]			
			newStr += base64Chars[b1&0x3F]
			newStr += base64Chars[((b1>>6)&0x03)|((b2&0x0F)<<2)]
			newStr += base64Chars[((b2>>4)&0x0F)|((b3&0x03)<<4)]
			newStr += base64Chars[((b3>>2)&0x3F)]
		}
	}
	return newStr
}

function decodeBuffer(str){
	var byteLen = Math.floor(str.length/4)*3
	var rem = str.length - Math.floor(str.length/4)*4
	if(rem === 3){
		byteLen += 2
	}else if(rem === 2){
		byteLen += 1
	}else if(rem === 0){
	}else{
		throw new Error('logic error: ' + rem)
	}
	
	var buf
	if(typeof Buffer !== 'undefined'){
		buf = new Buffer(byteLen)
	}else{
		buf = new Uint8Array(byteLen)
	}
	var i=0
	var j=0
	while(i < str.length){
		if(i+2 >= str.length){
			var b1 = charToByte[str[i++]]
			var b2 = charToByte[str[i++]]

			buf[j++] = b1|((b2&0x03)<<6)
		}else if(i+3 >= str.length){
			var b1 = charToByte[str[i++]]
			var b2 = charToByte[str[i++]]
			var b3 = charToByte[str[i++]]

			buf[j++] = b1|((b2&0x03)<<6)
			buf[j++] = ((b2>>2)&0x0F)|((b3&0x0F)<<4)
		}else{
			var b1 = charToByte[str[i++]]
			var b2 = charToByte[str[i++]]
			var b3 = charToByte[str[i++]]
			var b4 = charToByte[str[i++]]

			buf[j++] = b1|((b2&0x03)<<6)
			buf[j++] = ((b2>>2)&0x0F)|((b3&0x0F)<<4)
			buf[j++] = ((b3>>4)&0x03)|(b4<<2)
		}		
	}
	if(j !== byteLen) throw new Error('logic error: ' + j + ' ' + byteLen)
	//console.log('decoded: ' + str + '->' + newStr.length)
	return buf
}

/*
function randomByte(){return Math.floor(Math.random()*256);}
function testBuffers(){
	var totalBytes = 0
	var start = Date.now()
	for(var z=0;z<1000;++z){	
		var len = Math.floor(Math.random()*10000)
		var buf = new Buffer(len)
		for(var i=0;i<len;++i){
			var c = randomByte()
			totalBytes += 1
			buf[i] = c
		}
		
		var encoded = encodeBuffer(buf)
		var decoded = decodeBuffer(encoded)
		
		if(decoded.length !== buf.length){
			throw new Error('different lengths: ' + decoded.length + ' ' + buf.length)
		}
		
		//console.log('length: ' + decoded.length)
		for(var i=0;i<decoded.length;++i){
			//console.log(decoded[i] + ' ' + buf[i])
			if(decoded[i] !== buf[i]){
				console.log('length: ' + decoded.length)
				throw new Error('different: ' + i + ' ' + decoded[i] + ' ' + buf[i] + ' ' + decoded + ' ' + buf)
			}
		}
	}
	console.log('tested - generated, encoded, decoded, and compared - ' + Math.floor(totalBytes/1024) + ' KB ' + (Date.now()-start)+'ms')
}
testBuffers()*/

/*
function randomTwoBytes(){return Math.floor(Math.random()*65536);}
function test(){

	var str
	
	str = String.fromCharCode(63,63,63)
	encoded = encode(str)
	decoded = decode(encoded)
	if(decoded !== str){
		for(var i=0;i<encoded.length;++i){
			console.log(charToByte[encoded[i]] + ' ' + (charToByte[encoded[i]]).toString(2))
		}
		throw new Error('does not match(' + str + ') (' + decoded + ') (' + encoded + ')')
	}
	
	var start = Date.now()

	var totalBytes = 0
	for(var z=0;z<1000;++z){	
		str = ''
		var len = Math.floor(Math.random()*10000)
		for(var i=0;i<len;++i){
			var c = String.fromCharCode(randomTwoBytes())
			totalBytes += 2
			str += c
		}
	
		var encoded = encode(str)
		var decoded = decode(encoded)
		if(str !== decoded){
			if(str.length !== decoded.length){
				if(decoded.length > str.length) console.log('different: ' + decoded.charCodeAt(decoded.length-1))
				console.log('length different: ' + str.length + ' ' + decoded.length + ' (' + encoded.length + ')')
			}
			for(var i=0;i<str.length;++i){
				if(str[i] !== decoded[i]){
					console.log('first difference at: ' + i)
				}
			}
			throw new Error('test of b64 failed: \n' + str + '\n' + encoded + '\n' + decoded)
		}
	}
	console.log('tested - generated, encoded, decoded, and compared - ' + Math.floor(totalBytes/1024) + ' KB ' + (Date.now()-start)+'ms')
	

	str = ''
	var len = 1024*1024*10
	for(var i=0;i<len;++i){
		var c = String.fromCharCode(randomTwoBytes())
		str += c
	}

	var start = Date.now()
	var encoded = encode(str)
	var decoded = decode(encoded)
	
	console.log('encoded and decoded 20MB in ' + (Date.now()-start))
}
test()*/


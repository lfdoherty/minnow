"use strict";

var avg = 1024;
var count = 0;
function BufferWriteStream(){
	this.b = new Buffer(Math.ceil(avg)*2);
	this.off = 0;
	this.done = false;
}
BufferWriteStream.prototype.write = function(b){
	if(this.b.length - this.off < b.length){
		var nb = new Buffer((this.off+b.length)*2);
		this.b.copy(nb, 0, 0, this.off);
		this.b = nb;
	}
	b.copy(this.b, this.off, 0);
	this.off += b.length;
}
BufferWriteStream.prototype.end = function(cb){
	this.done = true;
	if(cb) cb();
}
BufferWriteStream.prototype.get = function(){
	if(!this.done) _.errout('error, BufferWriteStream has not been ended yet');
	var res = this.b.slice(0, this.off);
	avg = (avg*(count/(count+1))) + res.length/(count+1);
	++count;
	//console.log(avg + ' over ' + count);
	return res;
}

exports.BufferWriteStream = BufferWriteStream;

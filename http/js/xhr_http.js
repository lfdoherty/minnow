
var XMLHttpRequest = require('xhr').XMLHttpRequest

exports.getJson = getJson
exports.postJson = postJson

function getJson(url, cb, errCb){
	//if(arguments.length !== 2) throw new Error('getJson(url,cb) should not be called with ' + arguments.length + ' arguments')
    var xhr = new XMLHttpRequest();  
    
  	if(typeof(url) !== 'string') throw new Error('url must be a string: ' + url + ' ' + typeof(url))
    
    console.log('getJson: ' + url)
    
    xhr.open("GET", url, true);
    //xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.onreadystatechange = function (oEvent) {  
		if (xhr.readyState === 4) {  
			if (xhr.status === 200) {  
               console.log('parsing response text(' + xhr.responseText.substr(0,300) + ')')
               //console.log(url)
				//console.log('response headers are:' + xhr.getAllResponseHeaders());
				try{
	                var json = JSON.parse(xhr.responseText)
	            }catch(e){
		            throw new Error('cannot parse getJson response: ' + xhr.responseText + ' ' + url)
	            }
                if(json === undefined) throw new Error('cannot parse getJson response')
				if(cb) cb(json)
			} else {  
				console.log("Error", xhr.statusText, url);  
				if(errCb) errCb(xhr.status)
			}  
		}  
	};  
	xhr.send(null); 
}

function postJson(url, content, cb, errCb){
	//if(arguments.length !== 3) throw new Error('postJson(url,content,cb) should not be called with ' + arguments.length + ' arguments')

    var xhr = new XMLHttpRequest();  
    
    console.log('postJson: ' + url)
    
    xhr.open("POST", url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function (oEvent) {  
		if (xhr.readyState === 4) {  
			if (xhr.status === 200) {  
				cb()
			} else {  
				console.log("Error", xhr.statusText, url);  
				errCb(xhr.status)
			}  
		}  
	};  
	xhr.send(JSON.stringify(content)); 
}


var _ = require('underscorem')

exports.make = makePropertyRefer

function stub(){}

function makePropertyRefer(p){
	if(p.type.type === 'set' || p.type.type === 'list'){
		if(p.type.members.type === 'object'){
			return function(state, res){
				if(state && state.length > 0){
					//_.errout('TODO: ' + JSON.stringify(state))
					for(var i=0;i<state.length;++i){
						//_.assertInt(state[i])
						var id = state[i]
						if(id.inner) id = id.top
						_.assertInt(id)
						res.objectIds.push(id)
					}
					//res.objectIds = res.objectIds.concat(res)
				}
				//console.log(JSON.stringify([state, res]))
			}
		}else if(p.type.members.type === 'view'){
			return function(state, res){
				if(state && state.length > 0){
					//_.errout('TODO: ' + JSON.stringify(state))
					for(var i=0;i<state.length;++i){
						_.assertString(state[i])
					}
					res.viewIds = res.viewIds.concat(state)
				}
				//console.log(JSON.stringify([state, res]))
			}
		}else if(p.type.members.type === 'primitive'){
			return stub
		}
		
	}else if(p.type.type === 'map'){
		if(p.type.key.type === 'object'){
			if(p.type.value.type === 'object'){
				//TODO				
				_.errout('TODO')
			}else if(p.type.value.type === 'view'){
				return function(state, res){
					if(state){
						var keys = Object.keys(state)
						//console.log('state: ' + JSON.stringify(state))
						for(var i=0;i<keys.length;++i){
							var k = keys[i]
							k = parseInt(k)
							_.assertInt(k)
							res.objectIds.push(k)
							var value = state[k]
							res.viewIds.push(value)
						}
					}
				}
			}else if(p.type.value.type === 'set' || p.type.value.type === 'list'){
				//TODO
				_.errout('TODO')
			}else{
				return function(state, res){
					if(state){
						var keys = Object.keys(state)
						console.log('state: ' + JSON.stringify(state))
						for(var i=0;i<keys.length;++i){
							var v = keys[i]
							v = parseInt(v)
							_.assertInt(v)
							res.objectIds.push(v)
						}
					}
				}
			}
		}else if(p.type.key.type === 'view'){
		}else if(p.type.key.type === 'primitive'){
			if(p.type.value.type === 'object'){
				return function(state, res){
					if(state){
						var keys = Object.keys(state)
						//console.log('state: ' + JSON.stringify(state))
					//	_.errout('here')
						for(var i=0;i<keys.length;++i){
							var v = state[keys[i]]
							_.assertInt(v)
							res.objectIds.push(v)
						}
					}
				}
			}else if(p.type.value.type === 'view'){
				return function(state, res){
					if(state){
						var keys = Object.keys(state)
						//console.log('state: ' + JSON.stringify(state))
						for(var i=0;i<keys.length;++i){
							var v = state[keys[i]]
							_.assertString(v)
							res.viewIds.push(v)
						}
					}
				}
			}else if(p.type.value.type === 'set'){
				if(p.type.value.members.type === 'object'){
					return function(state, res){
						if(state){
							var keys = Object.keys(state)
							//console.log('*** state: ' + JSON.stringify(state))
							//_.errout('here: ' + JSON.stringify(p))
							for(var i=0;i<keys.length;++i){
								var arr = state[keys[i]]
								for(var j=0;j<arr.length;++j){
									var value = arr[j]
									_.assertInt(value)
									res.objectIds.push(value)
								}
							}
						}
					}
				}else if(p.type.value.members.type === 'view'){
				}else{
					return stub
				}
			}else if(p.type.value.type === 'primitive'){
				return stub
			}else{
				_.errout('here: ' + JSON.stringify(p))
				return stub
			}
		}else{
			_.errout(JSON.stringify(p))
		}
	}else if(p.type.type === 'primitive'){
		return stub
	}else if(p.type.type === 'object'){
		return function(state, res){
			if(state){	
				_.assertInt(state)
				res.objectIds.push(state)
			}
		}
	}else if(p.type.type === 'view'){
		return function(state, res){
			if(state){	
				res.viewIds.push(state)
			}
		}
	}
	_.errout('TODO: ' + JSON.stringify(p))
}


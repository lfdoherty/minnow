"use strict";

var _ = require('underscorem')

function filterCounts(counts){
	var res = {}
	Object.keys(counts).forEach(function(k){
		var of = counts[k]
		var nr = {}
		var found = false
		Object.keys(of).forEach(function(lk){
			var v = of[lk]
			if(v > 10){
				nr[lk] = v
				found = true
			}
		})
		if(found){
			res[k] = nr
		}
	})
	return res
}

exports.make = function(name, params, getCb){
	_.assertArray(params)
	_.assertString(name)
	var pan = []
	params.forEach(function(p){
		if(p.analytics === undefined){
			_.errout('missing analytics: ' + p.name + ' ' + JSON.stringify(p) + ' ' + JSON.stringify(Object.keys(p)))
		}
		pan.push(p.analytics)
	})
	params = undefined
	
	var counts
	var handle = {
		computeSync: function(name){
			if(!counts.computeSync) counts.computeSync = {}
			if(!counts.computeSync[name]) counts.computeSync[name] = 0
			++counts.computeSync[name]
		},
		computeAsync: function(name){
			if(!counts.computeAsync) counts.computeAsync = {}
			if(!counts.computeAsync[name]) counts.computeAsync[name] = 0
			++counts.computeAsync[name]
		},
		gotProperty: function(propertyCode){
			_.assertInt(propertyCode)
			if(!counts.property) counts.property = {}
			if(!counts.property[propertyCode]) counts.property[propertyCode] = 0
			++counts.property[propertyCode]
		},
		gotPropertyChanges: function(propertyCode){
			_.assertInt(propertyCode)
			if(!counts.propertyDuring) counts.propertyDuring = {}
			if(!counts.propertyDuring[propertyCode]) counts.propertyDuring[propertyCode] = 0
			++counts.propertyDuring[propertyCode]
		},
		gotTypeIds: function(typeCode){
			_.assertInt(typeCode)
			if(!counts.gotTypeIds) counts.gotTypeIds = {}
			if(!counts.gotTypeIds[typeCode]) counts.gotTypeIds[typeCode] = 0
			++counts.gotTypeIds[typeCode]
		},
		accumulate: function(){
			var report = {
				name: name
			}
			if(Object.keys(counts).length > 0){
				report.self = filterCounts(counts)
				if(Object.keys(report.self).length === 0){
					delete report.self
				}
			}
			if(pan.length > 0){
				report.children = []
				for(var i=0;i<pan.length;++i){
					var p = pan[i]
					var res = p.accumulate()
					if(res){
						report.children.push(res)
					}
				}
			}
			if(!report.self && (!report.children || report.children.length === 0)) return
			return report
		},
		reset: function(){
			counts = {}
			for(var i=0;i<pan.length;++i){
				var p = pan[i]
				p.reset()
			}
		}
	}
	handle.reset()
	return handle
}

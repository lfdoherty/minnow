
exports.plugins = {
	add: require('./add'),
	sub: require('./sub'),
	div: require('./div'),
	greaterThan: require('./greaterThan'),
	lessThan: require('./lessThan'),
	eq: require('./eq'),
	and: require('./and'),
	or: require('./or'),
	either: require('./either'),
	union: require('./union'),
	'in': require('./in'),
	inKeys: require('./inKeys'),
	intersection: require('./intersection'),
	relativeComplement: require('./relativeComplement'),
	mapValue: require('./mapValue')
	//,cast: require('./cast')
	//TODO if we can figure out how to descend properly here, we can make cast a sync op
	//The problem is that when we get an object id from a sync plugin, we don't know
	//how to descend into it.
}

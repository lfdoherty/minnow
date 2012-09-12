
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
	intersection: require('./intersection')
}

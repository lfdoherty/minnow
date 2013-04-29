
exports.plugins = {
	add: require('./add'),
	sub: require('./sub'),
	div: require('./div'),
	greaterThan: require('./greaterThan'),
	greaterThanOrEqual: require('./greaterThanOrEqual'),
	lessThan: require('./lessThan'),
	sum: require('./sum'),
	range: require('./range'),
	eq: require('./eq'),
	and: require('./and'),
	or: require('./or'),
	not: require('./not'),
	either: require('./either'),
	any: require('./any'),
	union: require('./union'),
	'in': require('./in'),
	inKeys: require('./inKeys'),
	intersection: require('./intersection'),
	relativeComplement: require('./relativeComplement'),
	mapValue: require('./mapValue'),
	cast: require('./cast'),
	concat: require('./concat'),
	length: require('./length'),
	'if': require('./if'),
	mapMerge: require('./mapMerge'),
	exists: require('./exists'),
	list: require('./list'),
	keysByValues: require('./keysByValues'),
	parseInt: require('./parseInt')
}

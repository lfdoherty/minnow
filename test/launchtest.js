
var minnow = require('./../client/client')

var ooo = console.log

var _ = require('underscorem')

var port = 5938

exports['minnow'] = {
	
	'example_schema': {
		environments: [//'environments' is reserved word
			[
				{
					//initial: 'connect'//can also be a list if there are multiple options (or omit for all open states)
					many: 1,//specifies many in clustered instance set (can also be generator function)
					
					//...reused for nodesim
					files: './test_data',
					//host: 'localhost'
					name: 'ex'
				}
			]
		],
		db: ['ex,', function(done){
			minnow.db('example', '.', function(ex){
				done.db = ex
				done()
			})
		}],
		server: ['db,', function(done){
			var alreadyDone = false;
			done.db.makeServer(port, _.assureOnce(function(){
				if(alreadyDone) _.errout('multiple makeServer callbacks')
				alreadyDone = true
				done()
			}))
		}],
		client: ['server,', function(done){
			done.db.makeClient(port, function(c){
				done.ex = c;
				done();
			})
		}],
		get_general_view: ['client', function(done){
			done.ex.modify.get('general', [], function(generalHandle){
				done.gh = generalHandle;
				done();
			})
		}],
		make_doc: ['get_general_view', function(done){
			done.gh.makeObjectFromJson('sim', {}, function(id){
				console.log('got id')
				done.docId = id;
				done();
			})
		}],
		view_doc: ['make_doc', function(done){
			done.ex.modify.get('singledoc', [done.docId], function(h){
				console.log('got single doc')
				done.docView = h;
				done();
			});
		}]
	}
};

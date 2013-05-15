
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

exports.empty = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				done()
				
				/*done.poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.has('names') && c.names.size() === 2){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						v.make('entity')
						var n = v.make('blah')
						n.names.add('Bill')
						n.names.add('Ted')	
					})
				})*/
				
			})
		})
	})
}

var tabUrl = 'http://test.com'

function setupSidebarForm(c, v, cb){

	var h = v.make('user', {email: 'admin', hash: 'dummy'}, function(){
		
		var contact = h.make('contact', {userId: h.id(), name: h.email.value(), displayName: h.email.value()})
		
		h.admin.set(true)
		var webGroup = v.make('group', {name: 'web', creator: contact, doNotDisplayChatContacts: true, settings: {}}, function(){
			//setupGroupListening()
			
			var jot = v.make('nest', {name: 'jot'})
			
			var contactsField = v.make('contacts', {name: 'Contacts', creator: contact})
			
			var quoteForm = v.make('nest', {name: '', elements: [
				{type: 'text', name: 'Comments', text: '', placeholder: ''}
			]})

			var bookmarkForm = v.make('webpage', {url:'', title: '', name: '', elements: [
				{type: 'tags', name: 'Tags'},
				{type: 'text', name: 'Notes', text: '', placeholder: ''},
				{type: 'quotes', name: 'Quotes', many: 8},
				{type: 'snippets', name: 'Snippets'}
				//{type: 'history'}
			]})
			var snippetForm = v.make('snippet', {domId: '', text: '', offset: -1, name: '', elements: [
				{type: 'slider', name: 'Rate your mastery from 1 to 5:', minValue: 1, maxValue: 5, step: 1}
			]})
			
			/*var noteSection = v.make('nest', {creator: contact, elements: [
				jot
			]})
			var fieldSection = v.make('nest', {creator: contact, elements: [
				h.make('text'),
				v.make('checklist'),
				v.make('radio'),
				v.make('tags'),
				v.make('collection'),
				v.make('slider')
			]})
			var advancedFieldSection = v.make('nest', {creator: contact, elements: [
				v.make('contacts'),
				v.make('history'),
				v.make('quotes'),
				v.make('snippets')
			]})
			var advancedObjectSection = v.make('nest', {creator: contact, elements: [
				v.make('userSet', {name: 'User Set'})
			]})*/
			
			var sidebar = v.make('sidebar', {name: 'DefaultWebSidebar', creator: contact, hideHeader: true, elements: [
					{type: 'history', hideHeader: true, many: 8, name: '', elements: [
						//newMenu,
						contactsField
					]}
				],
				quoteForm: quoteForm,
				bookmarkForm: bookmarkForm,
				snippetForm: snippetForm,
				contextMenu: []//noteSection, fieldSection, advancedFieldSection, advancedObjectSection]
			})
			
			webGroup.sidebars.add(sidebar)
			
			cb(webGroup)
		})
	})
}
function setupUserStuff(c, v, cb){

	var sidebarInstance = v.make('sidebar', {name: 'name'})
	var userData = v.make('userData', {sidebar: sidebarInstance})
	var settings = v.make('settings')
	var u = v.make('user', {email: 'test', data: userData, settings: settings, hash: 'dummy'}, function(){
		
		
		var contact = u.make('contact', {userId: u.id(), displayName: u.email.value(), name: u.email.value()})
		u.setProperty('contact', contact)
		
		setupSidebarForm(c, v, function(webGroup){
		
			webGroup.members.add(u.contact)
		
			var session = v.make('userSession', {user: u.id(), syncId: -5})
			//u.setProperty('currentSession', session)

			var tab = v.make('tab', {url: tabUrl}, function(){

				//session.setProperty('currentTab', tab)
				
				var webpage = v.make('webpage', {creator: u.contact, url: tabUrl, title: 'test title', name: 'test title'}, function(){
				
					makeSidebar(c, u, function(){
						cb(u, session, tab, webpage)
					})
				})
			})
		})
	})
}

function makeSidebar(c, user, cb){
	c.view('userSidebar', [user.id()], function(err, v){
		if(!v.hasSidebar.value()){
			//use the candidate sidebar
			var candidateSidebar 
			if(v.userData.sidebarsByForked.has(v.candidateSidebarForm)){
				candidateSidebar = v.userData.sidebarsByForked.get(v.candidateSidebarForm)
			}else{
				candidateSidebar = v.make('sidebar', {name: 'name'})//v.candidateSidebarForm.fork()
				v.userData.sidebarsByForked.put(v.candidateSidebarForm, candidateSidebar)
			}
			console.log('forked sidebar')
			v.userData.setProperty('sidebarForm', v.candidateSidebarForm)
			v.userData.setProperty('sidebar', candidateSidebar)
			console.log('made sidebar')
		}
		cb()
	})
}

exports.openOverlayPage = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				setupUserStuff(client, c, function(u, session, tab){
					console.log('user stuff ready')

					minnow.makeClient(config.port, function(otherClient){
						console.log('getting view')
						otherClient.view('overlayPage', [u, session, tab], function(err, v){
							if(err) throw err
					
							done()
						})
					})
				})	
			})
		})
	})
}
/*
exports.openOverlayPageHistory = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				setupUserStuff(client, c, function(u, session, tab){

					minnow.makeClient(config.port, function(otherClient){
						console.log('getting historical view')
						otherClient.historicalView('userStoryPage', [u], function(err, v){
							if(err) throw err
					
							console.log('here')
							var stepCount = 0
							while(!v.isAtEnd()){
								console.log('step: ' + JSON.stringify(v.toJson()).length)
								var next = v.advance()
								console.log('next: ' + next)
								++stepCount
							}
							
							done()
						})
					})
				})	
			})
		})
	})
}
*/
exports.checkHistory = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				setupUserStuff(client, c, function(u, session, tab){

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('overlayPage', [u, session, tab], function(err, v){
							if(err) throw err
					
							console.log('children: ' + v.children)
							//console.log(JSON.stringify(v.sidebar))
							v.sidebar.locally(function(){
								v.sidebar.setForked(v.sidebarForm)
							})
							
							var childMap = v.children.get(v.sidebar.id()).children
							
							_.assert(v.sidebar.elements.count() > 0)
							
							//console.log('history: ' + v.sidebar.elements.at(0))
							//console.log('history parent: ' + v.sidebar.elements.at(0).getTopParent())
							console.log('history: ' + v.sidebar.elements.at(0).id())
							console.log('history parent: ' + v.sidebar.elements.at(0).getTopParent().id())
							console.log(childMap.toJson())
							//console.log(JSON.stringify(v.historyData.toJson()))
							//console.log(JSON.stringify(v.sidebar.elements.at(0).elements.toJson()))

							var set = childMap.get(v.sidebar.elements.at(0).id())
							
							_.assertObject(set)
							
							/*console.log('history: ' + v.sidebar.elements.at(0))
							console.log('childMap: ' + childMap)
							console.log('sidebar: ' + v.sidebar.id())
							console.log('set: ' + set.count())*/
							
							_.assert(set.count() === 1)
							
							done()
						})
					})
				})	
			})
		})
	})
	return 20*1000
}

exports.checkQuote = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				setupUserStuff(client, c, function(u, session, tab, webpage){

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('overlayPage', [u, session, tab], function(err, v){
							if(err) throw err
							
							console.log(JSON.stringify(v.children.toJson()))
							
							v.sidebar.locally(function(){
								v.sidebar.setForked(v.sidebarForm)
							})
							
							var childMap = v.children.get(v.sidebar.id()).children
							
							_.assert(v.sidebar.elements.count() > 0)
							
							console.log('were: ' + JSON.stringify(childMap.toJson()))
							
							var historyField = v.sidebar.elements.at(0)
							var set = childMap.get(historyField.id())
							
							console.log('looking for: ' + historyField.id())
							_.assert(set)
							
							var localWebpage
							set.each(function(nv){localWebpage = nv;})
							
							localWebpage.locally(function(){
								localWebpage.setForked(v.sidebar.bookmarkForm)
							})

							v.userData.expansionToggles.put(historyField.id()+'|'+localWebpage.id(), true)
							
							var quote = v.make('quote', {prefix: '', postfix: '', offset: -1, creator: u.contact, text: 'test quote text', originalOffset: 10, url: tabUrl}, function(){

								console.log('localWebpage: ' + localWebpage.id())
								console.log('children: ' + v.children)
								console.log('quote id: ' + quote.id())
						
								var childObj = v.children.get(localWebpage.id())
								_.assertObject(childObj)
								var childMap = childObj.children
								var quotesField = localWebpage.elements.at(2)
								console.log('quotesField id: ' + quotesField.id())
								console.log('historyField id: ' + historyField.id())
								console.log(childMap.toJson())
								console.log(localWebpage.id() + ' ' + JSON.stringify(v.children.toJson(), null, 2))
								var set = childMap.get(quotesField.id())
								//console.log('set: ' + set)
								
								_.assertDefined(set)
								
								_.assert(set.count() === 1)
								
								done()
							})
						})
					})
				})	
			})
		})
	})
	
	return 10*1000
}


exports.checkQuoteCount = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				setupUserStuff(client, c, function(u, session, tab, webpage){

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('statsPage', [u], function(err, v){
							if(err) throw err
							
							var quote = v.make('quote', {prefix: '', postfix: '', offset: -1, creator: u.contact, text: 'test quote text', originalOffset: 10, url: tabUrl}, function(){

								_.assertEqual(v.webpagesQuoted.value(), 1)
								done()
							})
						})
					})
				})	
			})
		})
	})
	
	return 10*1000
}
exports.checkQuoteRemoval = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				setupUserStuff(client, c, function(u, session, tab, webpage){

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('overlayPage', [u, session, tab], function(err, v){
							if(err) throw err
							
							v.sidebar.locally(function(){
								v.sidebar.setForked(v.sidebarForm)
							})
							
							var childMap = v.children.get(v.sidebar.id()).children
							
							_.assert(v.sidebar.elements.count() > 0)
							
							var historyField = v.sidebar.elements.at(0)
							var set = childMap.get(historyField.id())
							
							var localWebpage
							set.each(function(nv){localWebpage = nv;})
							
							localWebpage.locally(function(){
								localWebpage.setForked(v.sidebarForm.bookmarkForm)
							})

							v.userData.expansionToggles.put(historyField.id()+'|'+localWebpage.id(), true)
							
							var quote = v.make('quote', {prefix: '', postfix: '', offset: -1, creator: u.contact, text: 'test quote text', originalOffset: 10, url: tabUrl}, function(){

								console.log('localWebpage: ' + localWebpage.id())
								console.log('children: ' + v.children)
								console.log('quote id: ' + quote.id())
						
								var childObj = v.children.get(localWebpage.id())
								_.assertObject(childObj)
								var childMap = childObj.children
								var quotesField = localWebpage.elements.at(2)
								//console.log('quotesField id: ' + quotesField.id())
								var set = childMap.get(quotesField.id())
								//console.log('set: ' + set)
								
								_.assert(set.count() === 1)
								
								//done()
								quote.removed.set(true)
								
								setTimeout(function(){//TODO attach cb to quote.removed.set operation
									//TODO check that 'set' retrieved above has been invalidated as well
									
									var set = childMap.get(quotesField.id())
									console.log(childMap+'')
									_.assert(set === undefined || set.count() === 0)
									
									done()
								},5900)
							})
						})
					})
				})	
			})
		})
	})
	
	return 20*1000//desired delay
}

exports.checkQuoteDoubleAdd = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				setupUserStuff(client, c, function(u, session, tab, webpage){

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('overlayPage', [u, session, tab], function(err, v){
							if(err) throw err
							
							v.sidebar.locally(function(){
								v.sidebar.setForked(v.sidebarForm)
							})
							
							var childMap = v.children.get(v.sidebar.id()).children
							
							_.assert(v.sidebar.elements.count() > 0)
							
							var historyField = v.sidebar.elements.at(0)
							var set = childMap.get(historyField.id())
							
							var localWebpage
							set.each(function(nv){localWebpage = nv;})
							
							localWebpage.locally(function(){
								localWebpage.setForked(v.sidebarForm.bookmarkForm)
							})

							v.userData.expansionToggles.put(historyField.id()+'|'+localWebpage.id(), true)
							
							var quote = v.make('quote', {prefix: '', postfix: '', offset: -1, creator: u.contact, text: 'test quote text', originalOffset: 10, url: tabUrl}, function(){

								console.log('localWebpage: ' + localWebpage.id())
								console.log('children: ' + v.children)
								console.log('quote id: ' + quote.id())
						
								var childObj = v.children.get(localWebpage.id())
								_.assertObject(childObj)
								var childMap = childObj.children
								var quotesField = localWebpage.elements.at(2)
								//console.log('quotesField id: ' + quotesField.id())
								var set = childMap.get(quotesField.id())
								//console.log('set: ' + set)
								
								_.assert(set.count() === 1)
								
								//done()
								//quote.removed.set(true)
								
								v.make('quote', {prefix: '', postfix: '', offset: -1, creator: u.contact, text: 'second test quote text', originalOffset: 12, url: tabUrl}, function(){
									_.assert(set.count() === 2)
									
									done()
								})
							})
						})
					})
				})	
			})
		})
	})
	
	return 20*1000//desired delay before test times out
}

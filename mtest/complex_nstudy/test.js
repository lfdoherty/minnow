
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.empty = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				done()
				
				/*poll(function(){
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

	var h = v.make('user', {email: 'admin'}, function(){
		
		var contact = h.make('contact', {userId: h.id(), name: h.email.value()})
		
		h.admin.set(true)
		var webGroup = v.make('group', {name: 'web', creator: contact, doNotDisplayChatContacts: true, settings: {}}, function(){
			//setupGroupListening()
			
			var jot = v.make('nest', {name: 'jot'})
			
			var contactsField = v.make('contacts', {name: 'Contacts', creator: contact})
			
			var quoteForm = v.make('nest', {elements: [
				{type: 'text', name: 'Comments'}
			]})

			var bookmarkForm = v.make('webpage', {elements: [
				{type: 'tags', name: 'Tags'},
				{type: 'text', name: 'Notes'},
				{type: 'quotes', name: 'Quotes'},
				{type: 'snippets', name: 'Snippets'}
				//{type: 'history'}
			]})
			var snippetForm = v.make('snippet', {elements: [
				{type: 'slider', name: 'Rate your mastery from 1 to 5:'}
			]})
			
			var noteSection = v.make('nest', {creator: contact, elements: [
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
			]})
			
			var sidebar = v.make('sidebar', {name: 'DefaultWebSidebar', creator: contact, hideHeader: true, elements: [
					{type: 'history', hideHeader: true, elements: [
						//newMenu,
						contactsField
					]}
				],
				quoteForm: quoteForm,
				bookmarkForm: bookmarkForm,
				snippetForm: snippetForm,
				contextMenu: [noteSection, fieldSection, advancedFieldSection, advancedObjectSection]
			})
			
			webGroup.sidebars.add(sidebar)
			
			cb(webGroup)
		})
	})
}
function setupUserStuff(c, v, cb){

	var sidebarInstance = v.make('nest', {})
	var userData = v.make('userData', {sidebar: sidebarInstance})
	var settings = v.make('settings')
	var u = v.make('user', {email: 'test', data: userData, settings: settings}, function(){
		
		
		var contact = u.make('contact', {userId: u.id(), displayName: u.email.value()})
		u.setProperty('contact', contact)
		
		setupSidebarForm(c, v, function(webGroup){
		
			webGroup.members.add(u.contact)
		
			var session = v.make('userSession', {user: u.id()})
			var tab = v.make('tab', {url: tabUrl}, function(){
			
				var webpage = v.make('webpage', {creator: u.contact, url: tabUrl, title: 'test title'}, function(){
				
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
				candidateSidebar = v.candidateSidebarForm.fork()
				v.userData.sidebarsByForked.put(v.candidateSidebarForm, candidateSidebar)
			}
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

					minnow.makeClient(config.port, function(otherClient){
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
							
							var childMap = v.children.get(v.sidebar.id()).children
							
							_.assert(v.sidebar.elements.count() > 0)
							
							console.log('history: ' + v.sidebar.elements.at(0))
							console.log('history parent: ' + v.sidebar.elements.at(0).getTopParent())

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
							
							var childMap = v.children.get(v.sidebar.id()).children
							
							_.assert(v.sidebar.elements.count() > 0)
							
							var historyField = v.sidebar.elements.at(0)
							var set = childMap.get(historyField.id())
							
							var localWebpage
							set.each(function(nv){localWebpage = nv;})
							
							localWebpage.locally(function(){
								localWebpage.setForked(v.sidebar.bookmarkForm)
							})

							v.userData.expansionToggles.put(historyField.uid()+'|'+localWebpage.uid(), true)
							
							var quote = c.make('quote', {creator: u.contact, text: 'test quote text', originalOffset: 10, url: tabUrl}, function(){

								setTimeout(function(){//TODO REMOVE
									//console.log('localWebpage: ' + localWebpage.id())
									//console.log('children: ' + v.children)
									//console.log('quote id: ' + quote.id())
							
									var childObj = v.children.get(localWebpage.id())
									_.assertObject(childObj)
									var childMap = childObj.children
									var quotesField = localWebpage.elements.at(2)
									//console.log('quotesField id: ' + quotesField.id())
									var set = childMap.get(quotesField.id())
									//console.log('set: ' + set)
									
									_.assert(set.count() === 1)
									
									done()
								},300)
								
							})
							//console.log('made quote')
							
							/*webpage.removed.set(true)
							
							setTimeout(function(){
							
								_.assert(set.count() === 0)
								
								done()
							},1000)*/
						})
					})
				})	
			})
		})
	})
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
							
							var childMap = v.children.get(v.sidebar.id()).children
							
							_.assert(v.sidebar.elements.count() > 0)
							
							var historyField = v.sidebar.elements.at(0)
							var set = childMap.get(historyField.id())
							
							var localWebpage
							set.each(function(nv){localWebpage = nv;})
							
							localWebpage.locally(function(){
								localWebpage.setForked(v.sidebar.bookmarkForm)
							})

							v.userData.expansionToggles.put(historyField.uid()+'|'+localWebpage.uid(), true)
							
							var quote = c.make('quote', {creator: u.contact, text: 'test quote text', originalOffset: 10, url: tabUrl}, function(){

								setTimeout(function(){//TODO REMOVE
									//console.log('localWebpage: ' + localWebpage.id())
									//console.log('children: ' + v.children)
									//console.log('quote id: ' + quote.id())
							
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
									
									setTimeout(function(){
										_.assert(set.count() === 0)
										
										done()
									},900)
								},300)
								
							})
							//console.log('made quote')
							
							/*webpage.removed.set(true)
							
							setTimeout(function(){
							
								_.assert(set.count() === 0)
								
								done()
							},1000)*/
						})
					})
				})	
			})
		})
	})
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
							
							var childMap = v.children.get(v.sidebar.id()).children
							
							_.assert(v.sidebar.elements.count() > 0)
							
							var historyField = v.sidebar.elements.at(0)
							var set = childMap.get(historyField.id())
							
							var localWebpage
							set.each(function(nv){localWebpage = nv;})
							
							localWebpage.locally(function(){
								localWebpage.setForked(v.sidebar.bookmarkForm)
							})

							v.userData.expansionToggles.put(historyField.uid()+'|'+localWebpage.uid(), true)
							
							var quote = c.make('quote', {creator: u.contact, text: 'test quote text', originalOffset: 10, url: tabUrl}, function(){

								setTimeout(function(){//TODO REMOVE
									//console.log('localWebpage: ' + localWebpage.id())
									//console.log('children: ' + v.children)
									//console.log('quote id: ' + quote.id())
							
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
									
									c.make('quote', {creator: u.contact, text: 'second test quote text', originalOffset: 12, url: tabUrl})
									
									setTimeout(function(){
										_.assert(set.count() === 2)
										
										done()
									},900)
								},300)
								
							})
							//console.log('made quote')
							
							/*webpage.removed.set(true)
							
							setTimeout(function(){
							
								_.assert(set.count() === 0)
								
								done()
							},1000)*/
						})
					})
				})	
			})
		})
	})
}

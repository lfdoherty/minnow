"use strict";

/* 
	Time to beat (N, ms): (50000,16320)
	
*/


var N = 50000



var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

var tabUrl = 'http://test.com'

var minnow = require('./../../client/client')
var u = require('./../util')
u.reset(run)

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

	var sidebarInstance = v.make('sidebar', {})
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
			//console.log('forked sidebar')
			v.userData.setProperty('sidebarForm', v.candidateSidebarForm)
			v.userData.setProperty('sidebar', candidateSidebar)
			console.log('made sidebar')
		}
		cb()
	})
}

function run(){

	var start = Date.now()

	minnow.makeServer(u.config, function(){
		minnow.makeClient(u.config.port, function(client){
			client.view('empty', function(err, c){
				if(err) throw err
				
				setupUserStuff(client, c, function(um, session, tab, webpage){

					minnow.makeClient(u.config.port, function(otherClient){
						otherClient.view('overlayPage', [um, session, tab], function(err, v){
							if(err) throw err
							
							console.log(JSON.stringify(v.children.toJson()))
							
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
							
							for(var i=0;i<N;++i){
								var quote = c.make('quote', {creator: um.contact, text: 'test quote text', originalOffset: 10, url: tabUrl}, true)
							}
							
							poll(function(){
								var childObj = v.children.get(localWebpage.id())
								if(!childObj) return
								_.assertObject(childObj)
								var childMap = childObj.children
								if(!childMap) return
								var quotesField = localWebpage.elements.at(2)
								_.assertDefined(quotesField)
								var set = childMap.get(quotesField.id())
								if(set && set.count() === Math.min(20,N) && v.quoteCount.value() === N){
									console.log('done: ' + (Date.now()-start))
									process.exit(0)
								}else if(set){
									console.log('count: ' + set.count())
								}else{
									//console.log(JSON.stringify(childMap.toJson()))
								}
							})
											
							/*
								setTimeout(function(){//TODO REMOVE
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
								},600)
								
							})*/

						})
					})
				})	
			})
		})
	})
}


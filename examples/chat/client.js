
var minnow = require('../..')

var Port = 4039
var out = process.stdout
var inn = process.stdin

minnow.makeClient(Port, function(c){//get a DB connection to the server

	out.write('enter username: ')

	inn.resume();
	inn.setEncoding('utf8');

	var user
	var username
	var roomName
	var roomView

	var currentTask = getUsername
	inn.on('data', function (chunk) {
		var line = chunk.substr(0, chunk.length-1)
		currentTask(line)
	})
	
	function getUsername(line){
		username = line
		out.write('choose room: ')
		currentTask = chooseRoom
	}
	function chooseRoom(line){
		roomName = line
		inn.pause();
		currentTask = undefined
		
		c.view('roomView', [roomName], function(rv){//get a view of the room
			roomView = rv
			user = roomView.make('user', {name: username})//create a new user
			out.write('you have entered room: ' + roomName + '\n')
			prompt()
			inn.resume();
			
			//listen for new messages added to the room
			//any new messages that 'belong' to this room, according to the rules in
			//chat.minnow, will be sent from the server to the client
			//and will trigger this event
			roomView.messages.on('add', function(msg){
				if(msg.user !== user){
					out.write(msg.user.name.value() + '> ' + msg.text.value() + '\n')
				}
			})
			currentTask = sendMessage
		})
	}
	function sendMessage(line){
		//make a new message (anything we 'make' is automatically saved to the DB of course.)
		var msg = roomView.make('message', {text: line, user: user, roomName: roomName})
		
		//This shortcuts the roundtrip to the server.
		//Eventually the edit adding 'msg' to the room's messages will arrive from the server anyway
		//'modifying' views in this way is very helpful - it can save you from having to implement your 
		//own local data model separate from the one the DB provides, as you would have to with most DBs
		//if you needed to modify a local representation of the data synchronously.
		//In this case, it's not essential - but it does reduce latency.
		roomView.messages.add(msg)
		
		prompt()
	}

	function prompt(){out.write(username + '> ');}	
})


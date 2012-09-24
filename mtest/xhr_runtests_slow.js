/*

This is a special version of the test runner that adds a delay between getting the 
snapshot and making the live connection.  It detects cases where things get out of sync
during that delay.

*/

require('./../http/js/update_shared').slowGet = 1000

require('./xhr_runtests')

// Load dependencies
var app = require('electron').app,
    protocol = require('electron').protocol,
    ejs = require('ejs'),
    mime = require('mime')
    fs = require('fs'),
    url = require('url')

// Private variables
var userOpts = {}

// Helper functions
var compileEjs = function(contentBuffer) {
    var contentString = contentBuffer.toString(),
        compiledEjs = ejs.render(contentString, userOpts)

    return new Buffer(compiledEjs)
}

var protocolListener = function(request, callback) {
    try {
        var fileName = url.parse(request.url).pathname,
            fileContents = fs.readFileSync(fileName),
            extension = fileName.split('.').pop(),
            mimeType = mime.lookup(extension)

        if (extension === 'ejs') {
            userOpts.filename = fileName
            userOpts.ejse = this
            fileContents = compileEjs(fileContents)
            mimeType = 'text/html'
        }

        return callback({
            data: fileContents,
            mimeType: mimeType
        })

    } catch(exception) {
        return callback(-6) // NET_ERROR(FILE_NOT_FOUND, -6)
    }
}


// Module setup
var EJSE = function() {
    var self = this
    app.on('ready', function() {
        self.listen()
    })
}
EJSE.prototype = {

    // Start intercepting requests, looking for '.ejs' files.
    listen: function() {
        if (!protocol) return this
        protocol.interceptBufferProtocol('file', protocolListener.bind(this))
        return this
    },

    // Set the options to be passed in to `ejs.render()`.
    setOptions: function(optsIn) {
        userOpts = optsIn || {}
        return this
    },

    // Stop intercepting requests, restoring the original `file://` protocol handler.
    stopListening: function() {
        if (!protocol) return this

        protocol.uninterceptProtocol('file')
        return this
    }
}


// Expose stuff
module.exports = new EJSE()

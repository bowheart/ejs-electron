'use strict'

// Define the module
const EjsElectron = (module.exports = {
  data,
  listen,
  listening,
  options,
  stopListening,
})

// Load dependencies
const { app, protocol } = require('electron')
const ejs = require('ejs')
const fs = require('fs')
const mime = require('mime')
const path = require('path')

// Set up local state
let state = {
  data: {},
  listening: false,
  options: {},
}

// Method API

/**
 * EjsElectron.data() -- Get/set the data (context) that will be passed to `ejs.render()`.
 * Overloads:
 *
 * - ejse.data('key') -- Retrieve the value of 'key' in the current data set.
 * - ejse.data('key', 'val') -- Set 'key' to 'val' in the current data set.
 * - ejse.data({key: 'val'}) -- Replace the current data set with a new one containing {key: 'val'}
 */
function data(key, val) {
  return updateState('data', 'ejse.data()', key, val)
}

/**
 * EjsElectron.listen() -- Start intercepting requests on the 'file:' protocol, looking for '.ejs' files.
 * It is not necessary to call this function up-front, as ejs-electron starts listening as soon as it's loaded.
 * Use this only to start listening again after calling EjsElectron.stopListening().
 */
function listen() {
  if (state.listening) return EjsElectron // already listening; nothing to do here

  protocol.handle('file', protocolListener)
  state.listening = true
  return EjsElectron // for chaining
}

/**
 * EjsElectron.listening() -- True if ejs-electron is currently intercepting requests on the 'file:' protocol.
 */
function listening() {
  return state.listening
}

/**
 * EjsElectron.options() -- Get/set the options that will be passed to `ejs.render()`.
 * Overloads:
 *   ejse.options('key') -- Retrieve the value of 'key' in the current options set.
 *   ejse.options('key', 'val') -- Set 'key' to 'val' in the current options set.
 *   ejse.options({key: 'val'}) -- Replace the current options set with a new one containing {key: 'val'}
 */
function options(key, val) {
  return updateState('options', 'ejse.options()', key, val)
}

/**
 * EjsElectron.stopListening() -- Stop intercepting requests, restoring the original 'file:' protocol handler.
 */
function stopListening() {
  if (!state.listening) return EjsElectron // we're not listening; nothing to stop here

  protocol.unhandle('file')
  state.listening = false

  return EjsElectron
}

// Helper Functions
function compileEjs(pathname, contentBuffer) {
  state.data.ejse = EjsElectron
  state.options.filename = pathname

  let contentString = contentBuffer.toString()
  let compiledEjs = ejs.render(contentString, state.data, state.options)

  return new Buffer.from(compiledEjs)
}

function parsePathname(reqUrl) {
  let parsedUrl = new URL(reqUrl)
  let pathname = decodeURIComponent(parsedUrl.pathname)

  if (process.platform === 'win32' && !parsedUrl.host.trim()) {
    pathname = pathname.substring(1)
  }

  return pathname
}

function protocolListener(request) {
  try {
    let pathname = parsePathname(request.url)
    let fileContents = fs.readFileSync(pathname)
    let extension = path.extname(pathname)
    let mimeType = mime.getType(extension)

    if (extension === '.ejs') {
      fileContents = compileEjs(pathname, fileContents)
      mimeType = 'text/html'
    }

    return new Response(fileContents, {
      headers: { 'Content-Type': mimeType },
    })
  } catch (exception) {
    console.error(exception)

    if (exception.code === 'ENOENT') {
      // HTTP Error 404 - Not Found
      return new Response(null, { status: 404, statusText: 'Not Found' })
    }

    // Internal error e.g. ejs compilation error
    return new Response(null, { status: 500 })
  }
}

function updateState(field, context, key, val) {
  if (typeof key === 'string') {
    if (typeof val === 'undefined') return state[field][key]

    state[field][key] = val

    return EjsElectron // for chaining
  }

  if (Array.isArray(key) || typeof key !== 'object') {
    throw new TypeError(
      `EjsElectron Error - ${context} - Method accepts either a key and (optional) value or an object. Received ${typeof key}`
    )
  }

  state[field] = key

  return EjsElectron // for chaining
}

// Get this party started
app.on('ready', listen)

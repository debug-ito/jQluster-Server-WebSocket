// jQluster version 0.01
"use strict";

/**
 * @file Various utility methods for jQluster. These are for internal use only.
 * @author Toshio Ito
 * @requires jQuery
 * @requires jQuery.ellocate
 */

/** @namespace jQluster */
if(!jQluster) { var jQluster = {}; }

(function(my) {
    /**
     * @namespace
     * @lends jQluster
     */
    var utils = {
        /**
         * Create a UUID string. UUIDs are mainly used for message IDs.
         *
         * @todo Is this REALLY global unique???
         */
        uuid: function() {
            // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });
        },
        /** Convert 'arguments' object into a plain Array. */
        argsToArray: function(arguments_object) {
            return Array.prototype.slice.call(arguments_object, 0);
        },
        /** Clone a plain Object. */
        clone: function(obj) {
            return $.extend(true, {}, obj);
        },
        /** Stringify obj into JSON. Some dangerous elements in obj are ignored. */
        JSONstringifySafely: function(obj) {
            return JSON.stringify(obj, function(key, value) {
                if($.isWindow(value) || value === document || this === value || my.isHTMLElement(value)) {
                    return undefined;
                }else {
                    return value;
                }
            });
        },
        /** Clone obj via JSON (stringify -> parse). This simulates network communication using JSON. */
        cloneViaJSON: function(obj) {
            return JSON.parse(my.JSONstringifySafely(obj));
        },

        /** @returns true if val is not null or undefined. */
        defined: function(val) {
            return (val !== null && typeof(val) !== 'undefined');
        },

        /** @returns XPath string for the given jQuery object. */
        xpathFor: function($jquery_object) {
            // https://github.com/bimech/ellocate.js
            return $jquery_object.ellocate().xpath;
        },

        /** @returns true of obj looks like HTML Element. */
        isHTMLElement: function(obj) {
            // ** http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
            return (typeof HTMLElement === "object"
                    ? obj instanceof HTMLElement
                    : obj && typeof obj === "object" && obj !== null && obj.nodeType === 1 && typeof obj.nodeName==="string");
        },

        /** @returns a quoted version of str. */
        quoteString: function(str) {
            return JSON.stringify("" + str);
        },

        /** @returns a string that is a serialized version of the given 'arguments' object. */
        argumentsStringFor: function(args) {
            return $.map(my.argsToArray(args), function(arg) {
                return arg === null ? "null"
                    : arg === undefined ? "undefined"
                    : arg === true ? "true"
                    : arg === false ? "false"
                    : typeof arg === "number" ? arg
                    : JSON.stringify(arg);
            }).join(",");
        }
    };
    $.extend(my, utils);
})(jQluster);
"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { var jQluster = {}; }


(function(my, $) {
    /**
     * @class 
     * @alias jQluster.Connection
     * @classdesc jQluster abstract "Connection" class. A Connection
     * object is supposed to be contained by Transport object.
     *
     * @requires jQuery
     */
    var myclass = my.Connection = function() {
        this.receive_callbacks = [];
    };
    myclass.prototype = {
        /** Safely release the Connection's resource. */
        release: function() {
            this.receive_callbacks = [];
        },
        /**
         * Send data via this Connection.
         * @param {jQluster.Connection~Message} message
         * @returns nothing
         * @abstract
         *
         * @todo send() may fail, for example when the connection is
         * lost. What should we do in this case? Maybe it should
         * return a promise indicating whether it succeeds or not.
         */
        send: function() { throw "send() must be implemented"; },

        /**
         * @typedef {Object} jQluster.Connection~Message
         * @desc A message object that is exchanged via Connection.
         * @see doc/protocol.md in jQluster package.
         */
        
        /** 
         * @callback jQluster.Connection~ReceiveCallback
         * @param {jQluster.Connection~Message} message
         * @desc A callback that is called when some data is received via this Connection.
         */
        
        /**
         * Register receiveCallback
         * @param {jQluster.Connection~ReceiveCallback} callback
         * @returns nothing
         */
        onReceive: function(callback) {
            this.receive_callbacks.push(callback);
        },

        /**
         * Tell the Connection some data is arrived.
         * @returns nothing
         */
        triggerReceive: function(message) {
            $.each(this.receive_callbacks, function(i, callback) {
                callback(message);
            });
        },
    };
})(jQluster, jQuery);
"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { var jQluster = {}; }

(function(my, $) {
    var superclass = my.Connection;

    /**
     * @class
     * @alias jQluster.ConnectionWebSocket
     * @extends jQluster.Connection
     * @classdesc jQluster Connection implementation with WebSocket
     * @requires jQuery
     * @requires util.js
     * @requires Connection.js
     *
     * @param websocket_url - WebSocket URL ("ws://...") that it connects to.
     *
     * @todo WebSockets may be closed from the server side. What
     * should we do in this case?
     */
    var myclass = my.ConnectionWebSocket = function(websocket_url) {
        superclass.apply(this);
        this.url = websocket_url;
        this.websocket = null;
        this.send_buffer = [];
        this.is_socket_ready = false;
        this._initWebSocket();
    };
    $.each(["log", "error"], function(i, log_func) {
        myclass[log_func] = function(message) {
            console[log_func]("WebSocketConnection: " + message);
        };
    });
    myclass.prototype = $.extend(
        {}, superclass.prototype,
        /** @lends jQluster.ConnectionWebSocket.prototype */
        {
            _initWebSocket: function() {
                var self = this;
                var ws = new WebSocket(self.url);
                self.websocket = ws;
                myclass.log("WebSocket connect to " + self.url);
                ws.onopen = function() {
                    self.is_socket_ready = true;
                    $.each(self.send_buffer, function(i, msg) {
                        self._doSend(msg);
                    });
                    self.send_buffer.length = 0;
                };
                ws.onmessage = function(message) {
                    try {
                        self.triggerReceive(JSON.parse(message.data));
                    }catch(e) {
                        myclass.error("Error while receiving: " + e);
                    }
                }
                ws.onclose = function() {
                    myclass.log("socket closed");
                    self.websocket = null;
                    self.is_socket_ready = false;
                };
                ws.onerror = function(e) {
                    myclass.error("WebSocket error: " + e);
                };
            },
            /**
             * send a message via the WebSocket connection.
             */
            send: function(message) {
                var self = this;
                if(!my.defined(self.websocket) || !self.is_socket_ready) {
                    self.send_buffer.push(message);
                    return;
                }
                self._doSend(message);
            },
            _doSend: function(message) {
                try {
                    this.websocket.send(my.JSONstringifySafely(message));
                }catch(error) {
                    console.error("Cannot send the following message");
                    console.error(message);
                    throw error;
                }
            },
            release: function() {
                superclass.prototype.release.call(this);
                if(my.defined(this.websocket)) {
                    this.websocket.close();
                }
                this.websocket = null;
                this.is_socket_ready = false;
                this.send_buffer = [];
            }
        }
    );
})(jQluster, jQuery);
"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { var jQluster = {}; }

(function(my, $) {
    var REPLY_MESSAGE_TYPE_FOR = {
        select_and_get: "select_and_get_reply",
        select_and_listen: "select_and_listen_reply"
    };
    /**
     * @class
     * @alias jQluster.ServerLocal
     * @classdesc Local server implementation for testing and loopback transport.
     * @requires jQuery
     * @requires util.js
     * @requires Connection.js
     * @param {boolean} [args.debug=false] - if true, the server will emit debug messages.
     */
    my.ServerLocal = function(args) {
        if(!args) args = {};
        
        // Cyclic reference between the server and connections, but
        // it's (probably) ok.  JavaScript garbage collectors can
        // release cyclic objects UNLESS THE CYCLE DOES NOT INVOLVE
        // DOM NODES.
        this.connections = {};
        this.register_log = [];
        this.debug = !!args.debug;
    };
    /**
     * @alias jQluster.ServerLocal.prototype
     */
    my.ServerLocal.prototype = {
        _dlog: function(message, obj) {
            console.debug("ServerLocal: " + message);
            console.debug(obj);
        },
        /**
         * Register a Connection with the server.
         * @returns nothing
         * @param {jQluster.ConnectionLocal} connection - the connection.
         * @param node_id - Node ID of the connection.
         * @param {jQluster.Connection~Message} register_message_id -
         * the message of the type "register".
         */
        register: function(connection, node_id, register_message_id) {
            var self = this;
            if(self.debug) {
                self._dlog("Got register from " + node_id);
            }
            if(!self.connections[node_id]) {
                self.connections[node_id] = [];
            }
            self.register_log.push(node_id);
            self.connections[node_id].push(connection);
            self.distribute({
                message_id: my.uuid(),
                message_type: "register_reply",
                from: null, to: node_id,
                body: { error: null, in_reply_to: register_message_id }
            });
        },
        _tryReplyTo: function(original_message, error) {
            var reply_message_type = REPLY_MESSAGE_TYPE_FOR[original_message.message_type];
            if(!my.defined(error)) {
                error = null;
            }
            if(!my.defined(reply_message_type)) return;
            this.distribute({
                message_id: my.uuid(),
                message_type: reply_message_type,
                from: null, to: original_message.from,
                body: { error: error, in_reply_to: original_message.message_id }
            });
        },

        /**
         * Distribute the given message to all destination connections.
         * @returns nothing.
         * @param {jQluster.Connection~Message} message - message to distribute.
         */
        distribute: function(message) {
            var self = this;
            if(self.debug) {
                self._dlog("Send message: " + message.message_type, message);
            }
            var conn_list = self.connections[message.to];
            if(!conn_list) {
                self._tryReplyTo(message, "target node does not exist.");
                return;
            }
            $.each(conn_list, function(i, conn) {
                var dup_message = my.cloneViaJSON(message);
                conn.triggerReceive(dup_message);
            });
        },

        /**
         * @returns {Array} the registration log.
         */
        getRegisterLog: function() { return this.register_log; },

        /**
         * Safely release the server's resource.
         * @returns nothing
         */
        release: function() {
            var self = this;
            $.each(self.connections, function(node_id, connection_list) {
                $.each(connection_list, function(i, connection) {
                    connection.release();
                });
            });
            self.connections = {};
            self.register_log = [];
        },
    };
})(jQluster, jQuery);

"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { var jQluster = {}; }

(function(my, $){
    var superclass = my.Connection;

    /**
     * @class
     * @alias jQluster.ConnectionLocal
     * @extends jQluster.Connection
     *
     * @classdesc Local connection implementation for testing and loopback transport.
     * @requires jQuery
     * @requires util.js
     * @requires Connection.js
     *
     * @example
     * var server = new jQluster.ServerLocal();
     * var conn = new jQluster.ConnectionLocal(server);
     *
     * @param {jQluster.ServerLocal} server - local server object.
     */
    my.ConnectionLocal = function(server) {
        superclass.apply(this);
        this.server = server;
        this.log = [];
    };
    my.ConnectionLocal.prototype = $.extend(
        {}, superclass.prototype,
        /** @lends jQluster.ConnectionLocal.prototype */
        {
            /** send a message to the local server. */
            send: function(message) {
                this.log.push({ direction: "send",  message: my.clone(message)});
                // console.log("send: type: " + message.message_type + ", from: " + message.from);
                if(message.message_type === "register") {
                    this.server.register(this, message.body.node_id, message.message_id);
                }else {
                    this.server.distribute(message);
                }
            },
            triggerReceive: function(message) {
                this.log.push({ direction: "receive", message: my.clone(message)});
                return superclass.prototype.triggerReceive.call(this, message);
            },
            release: function() {
                superclass.prototype.release.call(this);
                this.server = null;
                this.log = [];
            },

            // below are ConnectionLocal specific functions
            getLog: function() { return this.log; },
            clearLog: function() { this.log = [] }
        }
    );
})(jQluster, jQuery);
"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { var jQluster = {}; }


(function(my, $) {
    /**
     * @class
     * @alias jQluster.Transport
     * @classdesc jQluster.Transport represents a jQluster node. It
     * abstracts jQluster messaging protocol.
     *
     * It uses a jQluster.Connection object to send and receive
     * messages to/from other nodes. It handles messages it receives
     * and executes what they demand (although maybe this function
     * should be refactored into another class).
     *
     * @requires jQuery
     * @requires jQuery.xpath
     * @requires util.js
     *
     * @todo Design and implement some mechanism for node grouping. In
     * the current implementation, it is possible for multiple nodes
     * to have the same ID. However, in this case there is no way to
     * distinguish individual nodes with that ID. With a proper
     * grouping mechanism, the user would be able to multi-cast a
     * message (e.g. a 'select_and_listen' message) and still
     * distinguish individual node in the group (e.g. the exact node
     * that sends a 'signal' message).
     *
     * @example
     * var alice = new jQluster.Transport({
     *     node_id: "Alice",
     *     connection_object: new jQluster.ConnectionWebSocket("ws://example.com/jqluster/server")
     * });
     *
     * console.log("I'm " + alice.getNodeID());   // => I'm Alice
     * 
     * alice.selectAndGet({node_id: "Bob", eval_code: "1 + 10"}).then(function(result) {
     *     console.log("result: " + result);  // => result: 11
     * }, function(error) {
     *     console.error(error);
     * });
     * 
     * alice.selectAndListen({
     *     node_id: "Bob", eval_code: "$('#some-button')",
     *     method: "on", options: ["click"],
     *     callback: function() {
     *         console.log("some-button is clicked.");
     *         console.log(this); // => a RemoteDOMPointer object pointing #some-button
     *     }
     * });
     *
     * @param {string} args.node_id - Node ID of this transport.
     * @param {jQluster.Connection} args.connection_object - the underlying Connection object.
     */
    var myclass = my.Transport = function(args) {
        var self = this;
        if(!my.defined(args.node_id)) {
            throw "node_id param is mandatory";
        }
        if(!my.defined(args.connection_object)) {
            throw "connection_object param is mandatory";
        }
        self.node_id = args.node_id;
        self.connection_object = args.connection_object;
        self.pending_request_for = {};
        self.signal_callback_for = {};
        
        self.connection_object.onReceive(function(message) { self._onReceive(message); });
        self.connection_object.send({
            message_id: my.uuid(), message_type: "register",
            from: self.node_id, to: null,
            body: { node_id: self.node_id }
        });
    };
    myclass.prototype = {
        /** @returns {string} Node ID of this transport. */
        getNodeID: function() { return this.node_id; },

        /**
         * Execute the given code and get the result from a remote
         * Node.
         *
         * @param {string} args.node_id - the Node ID of the remote Node.
         * @param {string} args.eval_code - the JavaScript code that
         * is evaluated on the remote node.
         *
         * @returns {jQuery.Promise} In success, the promise is
         * resolved and it contains the obtained data. In failure it
         * is rejected and it contains the cause of the error.
         * 
         * If the remote node does not exist, the returned Promise
         * will be rejected.
         * 
         * If there are multiple remote nodes, the caller will receive
         * the result returned by one of the remote nodes, but it is
         * not defined exactly which remote node is used.
         */
        selectAndGet: function(args) {
            var self = this;
            var response_d = $.Deferred();
            try {
                if(!my.defined(args.eval_code)) {
                    throw "eval_code param is mandatory";
                }
                if(!my.defined(args.node_id)) {
                    throw "node_id param is mandatory";
                }
                var message = {
                    message_id: my.uuid(), message_type: "select_and_get",
                    from: self.node_id, to: args.node_id,
                    body: { eval_code: args.eval_code, node_id: args.node_id }
                };
                self.pending_request_for[message.message_id] = response_d;
                self.connection_object.send(message);
            }catch(e) {
                response_d.reject(e);
            }
            return response_d.promise();
        },

        /**
         * Select a jQuery object on a remote Node and register a
         * callback on it. With this method you can listen to events
         * that occur on the remote Node.
         *
         * @param {string} args.node_id - the remote Node ID.
         *
         * @param {string} args.eval_code - the JavaScript code that
         * is executed on the remote Node. It must return jQuery
         * object.
         *
         * @param {string} args.method - the name of the method called
         * on the jQuery object that "args.eval_code" returns. The
         * method must accept a callback function as its last
         * argument.
         *
         * @param {Array} [args.options=[]] - arguments for the
         * "args.method" other than the callback.
         *
         * @param {function} args.callback - the callback function
         * that is called when an event on the remote Node occurs.
         *
         * Arguments for the args.callback is exact copy of the
         * arguments for the remote callback, except that DOM elements
         * are converted to {@link jQluster.Transport~RemoteDOMPointer}
         * objects. 'this' object for args.callback is the copy of
         * 'this' object for the remote callback. It may be a
         * {@link jQluster.Transport~RemoteDOMPointer} object, too.
         *
         * @returns {jQuery.Promise} the promise will be resolved if
         * the request is accepted by the remote node. The content of
         * the promise is meaningless in this case. In failure, it
         * will be rejected and it contains the cause of the error.
         * 
         * If the remote node does not exist, the resulting Promise
         * will be rejected.
         * 
         * If there are multiple remote nodes, all of them receive the
         * listen request. In this case, the resulting Promise
         * reflects one of the responses from those remote nodes, but
         * there is no guarantee on exactly which response is used to
         * affect the Promise.
         *
         * @todo About remote signal handler: For now there is no way
         * to REMOVE callbacks.  So, **calling selectAndListen() over
         * and over can cause memory leak**.  We need a way to remove
         * callbacks registered by this method.
         */
        selectAndListen: function(args) {
            var self = this;
            var result_d = $.Deferred();
            var message, callback;
            try {
                $.each(["node_id", "eval_code", "method", "callback"], function(i, mandatory_key) {
                    if(!my.defined(args[mandatory_key])) {
                        throw mandatory_key + " param is mandatory";
                    }
                });
                callback = args.callback;
                if(!my.defined(args.options)) args.options = [];
                message = {
                    message_id: my.uuid(), message_type: "select_and_listen",
                    from: self.node_id, to: args.node_id,
                    body: {
                        node_id: args.node_id, eval_code: args.eval_code, 
                        method: args.method, options: args.options
                    }
                };
                result_d.promise().then(function() {
                    self.signal_callback_for[message.message_id] = function(callback_this, callback_args) {
                        callback.apply(callback_this, callback_args);
                    };
                });
                self.pending_request_for[message.message_id] = result_d;
                self.connection_object.send(message);
            }catch(e) {
                result_d.reject(e);
            }
            return result_d.promise();
        },

        /**
         * Call this method when you receive a message.
         * @private
         * @param {jQluster.Connection~Message} message - the received message.
         * @returns nothing
         */
        _onReceive: function(message) {
            var self = this;
            if(message.to !== self.node_id) {
                console.debug("A message whose 'to' field is "+ (defined(message.to) ? message.to : "[null]")
                              + " is received but ignored because I'm "+ self.node_id);
                return;
            }
            if(message.message_type === "signal") {
                self._processSignal(message);
            }else if(my.defined(message.body.in_reply_to)) {
                self._onReply(message.body.in_reply_to, message);
            }else if(message.message_type === "select_and_get") {
                self._processSelectAndGet(message);
            }else if(message.message_type === "select_and_listen") {
                self._processSelectAndListen(message);
            }else {
                console.error("Unknown message received but discarded.");
                console.error(message);
            }
        },

        _KNOWN_REPLY_MESSAGE_TYPE: {
            select_and_get_reply: 1,
            select_and_listen_reply: 1
        },
        _onReply: function(in_reply_to, message) {
            var self = this;
            var pending_d = self.pending_request_for[in_reply_to];
            if(!my.defined(pending_d)) {
                return;
            }
            delete self.pending_request_for[in_reply_to];
            if(my.defined(self._KNOWN_REPLY_MESSAGE_TYPE[message.message_type])) {
                if(my.defined(message.body.error)) {
                    pending_d.reject(message.message_type + " error: " + message.body.error);
                }else {
                    pending_d.resolve(message.body.result);
                }
            }else {
                pending_d.reject("unkown message type: " + message.message_type);
            }
        },

        _processSelectAndGet: function(request_message) {
            var self = this;
            var result_p = null;
            try {
                result_p = $.when(eval(request_message.body.eval_code));
            }catch(e) {
                result_p = $.Deferred();
                result_p.reject(e);
            }
            var reply = {
                message_id: my.uuid(), message_type: "select_and_get_reply",
                from: self.node_id, to: request_message.from,
                body: { "error": null,  "result": null, "in_reply_to": request_message.message_id}
            };
            result_p.then(function(result) {
                reply.body.result = result;
            }, function(error) {
                reply.body.error = error;
            }).always(function() {
                self.connection_object.send(reply);
            });
        },

        _processSignal: function(message) {
            var self = this;
            if(my.defined(message.error)) {
                console.error("signal message error:");
                console.error(message);
                return;
            }
            var callback = self.signal_callback_for[message.body.in_reply_to];
            if(!my.defined(callback)) {
                return;
            }
            callback(message.body.callback_this, message.body.callback_args);
        },

        /**
         * An object that points to a DOM object on a remote Node.
         * @typedef {Object} jQluster.Transport~RemoteDOMPointer
         * @see doc/protocol.md in jQluster package
         */
        
        _createRemoteDOMPointerIfDOM: function(obj) {
            if(my.isHTMLElement(obj)) {
               return {
                   remote_node_id: this.node_id,
                   remote_type: "xpath",
                   remote_xpath: my.xpathFor($(obj))
               };
            }else {
                return obj;
            }
        },

        _processSelectAndListen: function(message) {
            var self = this;
            var jq_node;
            var args_for_method;
            var request_id = message.message_id;
            var request_from = message.from;
            var reply_sent = false;
            var try_send_reply = function(error) {
                if(reply_sent) return;
                reply_sent = true;
                self.connection_object.send({
                    message_id: my.uuid(), message_type: "select_and_listen_reply",
                    from: self.node_id, to: request_from,
                    body: {error: error, result: (my.defined(error) ? null : "OK"), in_reply_to: request_id}
                });
            };
            try {
                jq_node = eval(message.body.eval_code);
                args_for_method = message.body.options;
                args_for_method.push(function() {
                    var callback_this = self._createRemoteDOMPointerIfDOM(this);
                    var callback_args = [];
                    var i;
                    for(i = 0 ; i < arguments.length ; i++) {
                        callback_args.push(self._createRemoteDOMPointerIfDOM(arguments[i]));
                    }
                    try_send_reply(null);
                    self.connection_object.send({
                        message_id: my.uuid(), message_type: "signal",
                        from: self.node_id, to: request_from,
                        body: { error: null, in_reply_to: request_id,
                                callback_this: callback_this, callback_args: callback_args}
                    });
                });
                jq_node[message.body.method].apply(jq_node, args_for_method);
                try_send_reply(null);
            }catch(e) {
                try_send_reply("_processSelectAndListen error: " + e);
            }
        },

        /**
         * Safely release the resource that this Transport has.
         * @returns nothing
         */
        release: function() {
            if(my.defined(this.connection_object)) {
                this.connection_object.release();
            }
            this.connection_object = null;
            this.pending_request_for = {};
            this.signal_callback_for = {};
        }
    };
    
})(jQluster, jQuery);
"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { var jQluster = {}; }

(function(my, $) {
    var superclass = my.Transport;
    /**
     * @class
     * @alias jQluster.TransportLoopback
     * @extends jQluster.Transport
     *
     * @classdesc jQluster.TransportLoopback is a subclass of {@link
     * jQluster.Transport}. It connects only to itself.
     *
     * @requires jQuery
     * @requires util.js
     * @requires ServerLocal.js
     * @requires ConnectionLocal.js
     * @requires Transport.js
     *
     * The constructor. It takes no argument.
     */
    var myclass = my.TransportLoopback = function() {
        this.loopback_server = new my.ServerLocal();
        superclass.call(this, {
            node_id: "self",
            connection_object: new my.ConnectionLocal(this.loopback_server)
        });
    };
    myclass.prototype = $.extend(
        {}, superclass.prototype,
        /** @lends jQluster.TransportLoopback.prototype */
        {
            /**
             * Same as {@link jQluster.Transport#selectAndGet} except
             * that it operates on the local node no matter what ID is
             * given as `args.node_id`.
             */
            selectAndGet: function(args) {
                if(!args) args = {};
                args.node_id = "self";
                return superclass.prototype.selectAndGet.call(this, args);
            },
            /**
             * Same as {@link jQluster.Transport#selectAndListen}
             * except that it operates on the local node no matter
             * what ID is given as `args.node_id`.
             */
            selectAndListen: function(args) {
                if(!args) args = {};
                args.node_id = "self";
                return superclass.prototype.selectAndListen.call(this, args);
            },
            release: function() {
                superclass.prototype.release.call(this);
                this.loopback_server.release();
                this.loopback_server = null;
            }
        }
    );
})(jQluster, jQuery);

"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { var jQluster = {}; }

(function(my, $) {
    /**
     * @class
     * @alias jQluster.RemoteSelector
     *
     * @classdesc jQluster.RemoteSelector is an object that is similar
     * to jQuery object (the one you get by `$(SOME_SELECTOR)`), but
     * it is a selector of DOM objects in a remote node.
     *
     * It wraps a {@link jQluster.Transport} object and provides a lot
     * of useful methods similar to jQuery's methods.
     *
     * @requires jQuery
     * @requires util.js
     * @requires Transport.js
     *
     * @see {@link http://api.jquery.com} for explanation of methods.
     *
     * @example
     * var alice = new jQluster.Transport({
     *     node_id: "Alice",
     *     connection_object: new jQluster.ConnectionWebSocket({
     *         websocket_url: "ws://example.com/jqluster"
     *     }),
     * });
     * var selector_alice_to_bob = new jQluster.RemoteSelector({
     *     transport: alice,
     *     node_id: "Bob",
     *     selector: "#some-button"
     * });
     * 
     * selector_alice_to_bob.val().then(function(value) {
     *     console.log("button value: " + value);
     * });
     * 
     * selector_alice_to_bob.on("click", function() {
     *     console.log("Button clicked");
     *     selector_alice_to_bob.val("Button clicked");
     * });
     * @param {jQluster.Transport} args.transport - the transport
     * object representing the local node.

     * @param {string} args.node_id - the Node ID of the target remote
     * node.
     *
     * @param {string} args.eval_code - JavaScript code that is
     * evaluated to get a jQuery object on the remote node. You must
     * specify `args.eval_code`, `args.selector` or `args.xpath`.
     *
     * @param {string} args.selector - a jQuery selector string that
     * is used to get a jQuery object on the remote node.
     *
     * @param {string} args.xpath - a XPath string that is used to get
     * a jQuery object on the remote node.
     *
     */
    var myclass = my.RemoteSelector = function(args) {
        if(!my.defined(args.transport)) {
            throw "transport parameter is mandatory";
        }
        if(!my.defined(args.node_id)) {
            throw "node_id parameter is mandatory";
        }
        this.transport = args.transport;
        this.node_id = args.node_id;
        if(my.defined(args.xpath)) {
            this.eval_code = myclass._getEvalCodeFromXPath(args.xpath);
        }else if(my.defined(args.selector)) {
            this.eval_code = myclass._getEvalCodeFromSelector(args.selector);
        }else if(my.defined(args.eval_code)) {
            this.eval_code = args.eval_code;
        }else {
            throw "Either eval_code, selector or xpath parameter is mandatory";
        }
    };
    myclass._getEvalCodeFromXPath = function(xpath) {
        return "$(document).xpath("+ my.quoteString(xpath) +")";
    };
    myclass._getEvalCodeFromSelector = function(selector) {
        return "$("+ my.quoteString(selector) +")";
    };
    myclass._logPromiseError = function(promise) {
        promise.then(null, function(error) {
            console.error(error);
        });
        return promise;
    };
    /**
     * @namespace
     */
    myclass.prototype = {
        _getEvalCode: function() { return this.eval_code; },

        /**
         * @todo on() method: For now, the return value from
         * user-given handler function is ignored. This means we
         * cannot control whether the specified event should propagate
         * to the upper elements or not. It is possible in theory to
         * send the user-generated return value back to the remote
         * node, but in this case the process of the remote node must
         * be blocked waiting for the return value to come. If we
         * could use a co-routine mechanism like task.js, waiting for
         * the return value from the network would not block the
         * entire process, but that's not a feature every browser
         * supports now.
        */
        on: function() {
            var self = this;
            var args = my.argsToArray(arguments);
            var events = args.shift();
            if(!my.defined(events)) {
                throw "events parameter is mandatory";
            }
            if($.isPlainObject(events)) {
                $.each(events, function(event_name, handler) {
                    var args_for_next = [event_name].concat(args);
                    args_for_next.push(handler);
                    self.on.apply(self, args_for_next);
                });
                return self;
            }
            var handler = args.pop();
            if(!my.defined(handler)) {
                throw "handler parameter is mandatory";
            }
            var options = [events].concat(args);
            var transport_args = {
                eval_code: self._getEvalCode(),
                method: "on", options: options,
                node_id: self.node_id, callback: handler
            };
            myclass._logPromiseError(self.transport.selectAndListen(transport_args));
            return self;
        },

        /**
         * 
         * @todo each() method: For now, there is no way to detect the
         * end of the "each" loop. The end of the loop should be
         * reported to the caller in some form of Promise. In
         * addition, the remote signal handler should be removed from
         * the Transport object at the end of the loop. This problem
         * is more serious when we implement ".map()" method, because
         * it would make no sense if it could not return any value at
         * the end of the loop.
         */
        each: function(handler) {
            var self = this;
            if(!my.defined(handler)) {
                throw "handler parameter is mandatory";
            }
            var loop_enabled = true;
            var result = self.transport.selectAndListen({
                eval_code: self._getEvalCode(),
                method: "each", node_id: self.node_id,
                callback: function(index, remote_elem) {
                    var callback_result;
                    if(loop_enabled) {
                        callback_result = handler.call(this, index, remote_elem);
                        if(callback_result === false) {
                            loop_enabled = false;
                        }
                    }
                }
            });
            myclass._logPromiseError(result);
            return self;
        },

        off: function(events, selector) {
            var args_str = my.defined(selector) ? my.argumentsStringFor([events, selector])
                                                : my.argumentsStringFor([events]);
            var result = this.transport.selectAndGet({
                eval_code: this._getEvalCode() + ".off("+ args_str +")",
                node_id: this.node_id
            });
            myclass._logPromiseError(result);
            return this;
        },

        promise: function(type, target) {
            var self = this;
            if (typeof type !== "string") {
		target = type;
		type = undefined;
	    }
            var args_str = (type === undefined) ? "" : my.argumentsStringFor([type]);
            var result_deferred = $.Deferred();
            self.transport.selectAndGet({
                eval_code: self._getEvalCode() + ".promise("+ args_str +")",
                node_id: self.node_id
            }).then(function() {
                result_deferred.resolveWith(self, [self]);
            }, function() {
                result_deferred.rejectWith(self, [self]);
            });
            return result_deferred.promise(target);
        }
    };

    var selectionMethod = function(method_name) {
        myclass.prototype[method_name] = function() {
            return new myclass({
                transport: this.transport, node_id: this.node_id,
                eval_code: this.eval_code + "." + method_name + "("+ my.argumentsStringFor(arguments) +")"
            });
        };
    };
    $.each([
        "children", "closest", "contents", "eq",
        "end", "filter", "find", "first", "has", "is", "last",
        "next", "nextAll", "nextUntil", "not", "offsetParent",
        "parent", "parents", "parentsUntil",
        "prev", "prevAll", "prevUntil", "siblings", "slice",
    ], function(i, method_name) {
        selectionMethod(method_name);
    });

    var accessorMethod = function(method_name, min_arg, max_arg_get) {
        myclass.prototype[method_name] = function() {
            if(arguments.length < min_arg) {
                throw method_name + " needs at least" + min_arg + " arguments";
            }
            var eval_code = this.eval_code + "."+ method_name +"("+ my.argumentsStringFor(arguments) +")";
            var select_result = this.transport.selectAndGet({
                node_id: this.node_id, eval_code: eval_code
            });
            if(max_arg_get === null || arguments.length <= max_arg_get) {
                return select_result;
            }else {
                myclass._logPromiseError(select_result);
                return this;
            }
        };
    };
    $.each([
        ["attr", 1, 1], ["hasClass", 1, 1], ["val", 0, 0], ["css", 1, 1],
        ["height", 0, 0], ["innerHeight", 0, null], ["innerWidth", 0, null], ["outerHeight", 0, null],
        ["outerWidth", 0, null], ["width", 0, 0], ["data", 1, 1], ["text", 0, 0],
        ["index", 0, null], ["size", 0, null], ["html", 0, 0],
        ["position", 0, null], ["prop", 1, 1], ["scrollLeft", 0, 0], ["scrollTop", 0, 0],
        ["offset", 0, 0],
        ["addClass", 1, 0], ["after", 1, 0], ["append", 1, 0], ["appendTo", 1, 0],
        ["before", 1, 0], ["detach", 0, -1], ["empty", 0, -1], ["insertAfter", 1, 0], ["insertBefore", 1, 0],
        ["prepend", 1, 0], ["prependTo", 1, 0], ["remove", 0, -1], ["removeAttr", 1, 0], ["removeClass", 0, -1],
        ["removeProp", 1, 0], ["replaceAll", 1, 0], ["replaceWith", 1, 0], ["toggleClass", 1, 0],
        ["unwrap", 0, -1], ["wrap", 1, 0], ["wrapAll", 1, 0], ["wrapInner", 1, 0],
        ["trigger", 1, 0], 
    ], function(i, method_spec) {
        accessorMethod.apply(null, method_spec);
    });

    var effectsMethod = function(method_name) {
        myclass.prototype[method_name] = function() {
            var self = this;
            var args = my.argsToArray(arguments);
            var callback = null;
            var eval_code = self._getEvalCode();
            var select_result;
            if(args.length > 0 && $.isFunction(args[args.length-1])) {
                callback = args.pop();
            }
            if(my.defined(callback)) {
                select_result = self.transport.selectAndListen({
                    eval_code: eval_code,
                    node_id: self.node_id,
                    method: method_name,
                    options: args,
                    callback: callback
                });
            }else {
                eval_code += "."+ method_name +"("+ my.argumentsStringFor(args) +")";
                select_result = self.transport.selectAndGet({
                    eval_code: eval_code,
                    node_id: self.node_id
                });
            }
            myclass._logPromiseError(select_result);
            return self;
        };
    };
    $.each(["animate", "fadeIn", "fadeTo", "fadeOut", "fadeToggle",
            "slideDown", "slideUp", "slideToggle",
            "hide", "show", "toggle"], function(i, method_name) {
        effectsMethod(method_name);
    });

})(jQluster, jQuery);

/**
 * @name jQluster.RemoteSelector#Selection Methods
 * @method
 *
 * @desc This class has the following jQuery methods for DOM selection
 * on the remote node.
 *
 * - `children`
 * - `closest`
 * - `contents`
 * - `end`
 * - `eq`
 * - `filter`
 * - `find`
 * - `first`
 * - `has`
 * - `is`
 * - `last`
 * - `nextAll`
 * - `nextUntil`
 * - `next`
 * - `not`
 * - `offsetParent`
 * - `parent`
 * - `parentsUntil`
 * - `parents`
 * - `prevAll`
 * - `prevUntil`
 * - `prev`
 * - `siblings`
 * - `slice`
 *
 * @todo Only string arguments (such as ".some-class") are currently
 * supported. HTML elements or jQuery objects are not supported as
 * arguments.
 *
 */

/**
 * @name jQluster.RemoteSelector#Accessor Methods
 * @method
 *
 * @desc This class has the following jQuery methods for
 * getting/setting various data on the remote node.
 *
 * Note that getter methods return their results as a jQuery.Promise,
 * which is not the same way as the original jQuery. This is
 * inevitable because getting values from remote nodes involves
 * communication over the network, with potential delay and
 * communication error.
 *
 * - `addClass`
 * - `after`
 * - `appendTo`
 * - `append`
 * - `attr`
 * - `before`
 * - `css`
 * - `data`
 * - `detach`
 * - `empty`
 * - `hasClass`
 * - `height`
 * - `html`
 * - `index`
 * - `innerHeight`
 * - `innerWidth`
 * - `insertAfter`
 * - `insertBefore`
 * - `off`
 * - `offset`
 * - `outerHeight`
 * - `outerWidth`
 * - `position`
 * - `prependTo`
 * - `prepend`
 * - `promise`
 * - `prop`
 * - `removeAttr`
 * - `removeClass`
 * - `removeProp`
 * - `remove`
 * - `replaceAll`
 * - `replaceWith`
 * - `scrollLeft`
 * - `scrollTop`
 * - `size`
 * - `text`
 * - `toggleClass`
 * - `trigger`
 * - `unwrap`
 * - `val`
 * - `width`
 * - `wrapAll`
 * - `wrapInner`
 * - `wrap`
 *
 * @todo Only string arguments (such as ".some-class") are currently
 * supported. HTML elements or jQuery objects are not supported as
 * arguments.
 *
 * @todo **off() method**: this method removes the event handler attached
 * to the DOM objects in the remote node, but NOT the remote signal
 * handler attached to the local {@link jQluster.Transport} object. We
 * must figure out how to release the remote signal handler.
 *
 * @todo **setter methods**: they return the context object ('this'
 * remote selector), but this behavior is not completely the same as
 * the original jQuery. If further methods are chained from a setter
 * method, e.g. `$_(".foobar").height(100).find(".hoge").width(50)`,
 * it will be translated as two sentences on the remote node;
 * `$(".foobar").height(100)` and
 * `$(".foobar").find(".hoge").width(50);` The two sentences may do
 * what you mean, but may not sometimes especially if the intermediate
 * setter method manipulates DOM structure (because `$(".foobar")` is
 * evaluated again in the second sentence). If we were able to detect
 * method chaining and its termination, we could send a single
 * sentence in the above mentioned scenario, but it's not possible,
 * right? Or it would help to have actual jQuery objects on the remote
 * node that correspond to all RemoteSelector objects on the local
 * node. However, how can we release the jQuery objects on the remote
 * node that are no longer used? Perhaps we should just make setter
 * methods return nothing to prevent confusion.
 */

/**
 * @name jQluster.RemoteSelector#Effect Methods
 * @method
 *
 * @desc This class has the following methods for visual effects.
 *
 * - `animate`
 * - `fadeIn`
 * - `fadeOut`
 * - `fadeTo`
 * - `fadeToggle`
 * - `hide`
 * - `show`
 * - `slideDown`
 * - `slideToggle`
 * - `slideUp`
 * - `toggle`
 *
 */
"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { jQluster = {}; }

(function(my, $) {
    /**
     * @class
     * @alias jQluster.ReadinessCallbackManager
     *
     * @classdesc This class manages "readiness callbacks", callback
     * functions that are called when certain remote nodes are ready
     * for jQluster operations.
     *
     * You cannot listen to arbitrary remote nodes. If you want to
     * know a remote node's readiness, the remote node must notify
     * you. This is done by setting `notify` constructor argument of
     * the remote node's ReadinessCallbackManager.
     *
     * @requires jQuery
     * @requires util.js
     * @requires Transport.js
     *
     * @param {jQluster.Transport} args.transport - the Transport
     * object for the local node.
     *
     * @param {string[]} [args.notify=[]] - the list of remote
     * Node IDs that this manager notifies of its readiness.
     *
     */
    var myclass = my.ReadinessCallbackManager = function(args) {
        var self = this;
        var doc_factories;
        if(!my.defined(args.transport)) {
            throw "transport parameter is mandatory";
        }
        if(!my.defined(args.notify)) args.notify = [];
        if(!$.isArray(args.notify)) args.notify = [args.notify];

        self.transport = args.transport;
        self.notify_listeners_for = {};
        self.notified_dict = {};
        
        doc_factories = $(document).data("jqluster-readiness-callback-managers") || {};
        doc_factories[self.transport.getNodeID()] = self;
        $(document).data("jqluster-readiness-callback-managers", doc_factories);

        self._notify(args.notify);
    };
    myclass.release = function() {
        $(document).data("jqluster-readiness-callback-managers", {});
    };
    myclass.prototype = {
        _notify: function(notified_node_id_array) {
            var self = this;
            $.each(notified_node_id_array, function(i, notified_node_id) {
                self.notified_dict[notified_node_id] = true;
                self.transport.selectAndGet({
                    node_id: notified_node_id,
                    eval_code: '$(document).data("jqluster-readiness-callback-managers")['+ my.quoteString(notified_node_id) +']._beNotified('
                        + my.quoteString(self.transport.getNodeID()) +')'
                });
            });
        },
        /**
         * @private
         * @returns true if this manager notifies its readiness to notified_node_id. false otherwise.
         */
        _isNotifying: function(notified_node_id) {
            return this.notified_dict[notified_node_id] || false;
        },
        _beNotified: function(from_node_id) {
            var self = this;
            var listeners = self.notify_listeners_for[from_node_id];
            if(!listeners) return;
            $.each(listeners, function(i, callback) {
                callback();
            });
        },
        /**
         * @private
         * @returns a promise, resolved if the remote node is available, rejected if not.
         */
        _checkIfRemoteNodeAvailable: function(node_id) {
            var self = this;
            var result_d = $.Deferred();
            self.transport.selectAndGet({
                node_id: node_id,
                eval_code: '$(document).data("jqluster-readiness-callback-managers")['+ my.quoteString(node_id) +']._isNotifying('
                    + my.quoteString(self.transport.getNodeID()) +')'
            }).then(function(does_remote_node_notify_you) {
                if(does_remote_node_notify_you) {
                    result_d.resolve();
                }else {
                    result_d.reject("remote node exists, but it does not notify you.");
                }
            }, function() {
                result_d.reject("remote node does not exist or network error.");
            });
            return result_d.promise();
        },
        /**
         * Listen to a remote node for its readiness.
         *
         * Note that the `callback` is called immediately if the
         * remote node is already ready. After that, the `callback`
         * will be called every time the remote node gets ready (this
         * happens more than once if the remote node page is reloaded)
         *
         * @param {string} node_id - Node ID of the remote node.
         * @param {function} callback - the readiness callback function.
         * @returns nothing
         */
        listenToRemoteReadiness: function(node_id, callback) {
            var self = this;
            if(!self.notify_listeners_for[node_id]) {
                self.notify_listeners_for[node_id] = [];
            }
            self.notify_listeners_for[node_id].push(callback);
            self._checkIfRemoteNodeAvailable(node_id).then(function() {
                callback();
            });
        },
    };
})(jQluster, jQuery);
"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { jQluster = {}; }

(function(my, $) {
    var superclass = my.ReadinessCallbackManager;
    /**
     * @class
     * @alias jQluster.ReadinessCallbackManagerLoopback
     * @extends jQluster.ReadinessCallbackManager
     *
     * @classdesc This class is an extension of {@link
     * jQluster.ReadinessCallbackManager}, that redirects all "listen"
     * requiests to itself.
     *
     * @requires jQuery
     * @requires util.js
     * @requires Transport.js
     *
     * @param {jQluster.Transport} args.transport
     */
    var myclass = my.ReadinessCallbackManagerLoopback = function(args) {
        if(!args) args = {};
        if(!my.defined(args.transport)) {
            throw "transport parameter is mandatory";
        }
        args.notify = [args.transport.getNodeID()];
        superclass.call(this, args);
    };
    myclass.prototype = $.extend(
        {}, superclass.prototype,
        /** @lends jQluster.ReadinessCallbackManagerLoopback.prototype */
        {
            /**
             * Overridden to be loopback. No matter what ID is given
             * as `node_id` argument, it listens to itself for
             * readiness.
             * @see {@link jQluster.ReadinessCallbackManager#listenToRemoteReadiness}
             */
            listenToRemoteReadiness: function(node_id, callback) {
                return superclass.prototype.listenToRemoteReadiness.call(this, this.transport.getNodeID(), callback);
            },
        }
    );
})(jQluster, jQuery);
"use strict";

/**
 * @file
 * @author Toshio Ito
 */

if(!jQluster) { var jQluster = {}; }

(function(my, $) {
    var local_server;
    /**
     * @class
     * @alias jQluster.RemoteSelectorFactory
     *
     * @classdesc This class is a factory object for {@link
     * jQluster.RemoteSelector}s. It generates RemoteSelectors with a
     * certain transport specified by a string (transport ID).
     *
     * The following is the list of possible transport IDs.
     *
     * - WebSocket URL (e.g. "ws://example.com/jqluster")
     *     - It connects to a jQluster server via a WebSocket.
     * - "loopback"
     *     - It generates RemoteSelectors that always target to the local node.
     * - "local"
     *     - It connects to a jQluster server within the local node.
     *
     * @example
     * var factory_on_alice = new jQluster.RemoteSelectorFactory({
     *     node_id: "Alice",
     *     transport_id: "ws://example.com/jqluster",
     *     notify: ["Bob"]
     * });
     * 
     * var jquery_for_bob = factory_on_alice.forRemoteNode("Bob");
     * 
     * var remote_selector = jquery_for_bob("#some-button");
     * 
     * jquery_for_bob(function(arg) {
     *     // The callback called when Bob is ready.
     *     // arg === jquery_for_bob
     *     console.log("Bob is ready. I know it.");
     *     remote_selector.addClass("activated");
     * });
     * 
     * factory_on_alice.forRemoteNode("Charlie", function(jquery_for_charlie) {
     *     // The callback called when Charlie is ready.
     *     jquery_for_charlie("#some-box").text("Now Charlie is ready.");
     * });
     *
     * @requires jQuery
     * @requires util.js
     * @requires RemoteSelector.js
     * @requires Transport.js
     * @requires ServerLocal.js
     * @requires ConnectionLocal.js
     * @requires TransportLoopback.js
     * @requires ReadinessCallbackManager.js
     * @requires ReadinessCallbackManagerLoopback.js
     *
     * @param {string} args.node_id - The Node ID of the local node.
     *
     * @param {string} args.transport_id - A string that specifies the
     * transport to be used.
     *
     * @param {string[]} [args.notify=[]] - A list of Node ID strings
     * that it notifies of its readiness.
     * @see {@link jQluster.ReadinessCallbackManager}
     *
     * @todo What are supposed to do if the initialization fails? Like
     * when the WebSocket server is down? In this case, the error is
     * delayed so we need a promise to report it. Maybe we should
     * create a factory method for RemoteSelectorFactory instead of
     * the plain constructor.
     */
    var myclass = my.RemoteSelectorFactory = function(args) {
        if(!my.defined(args.node_id)) {
            throw "node_id parameter is mandatory";
        }
        if(!my.defined(args.transport_id)) {
            throw "transport_id parameter is mandatory";
        }
        this.transport = myclass._createTransport(args.node_id, args.transport_id);
        if(args.transport_id === "loopback") {
            this.readiness_callback_manager = new my.ReadinessCallbackManagerLoopback({
                transport: this.transport
            });
        }else {
            this.readiness_callback_manager = new my.ReadinessCallbackManager({
                transport: this.transport, notify: args.notify
            });
        }
    };
    myclass._createTransport = function(node_id, transport_id) {
        if(transport_id === "loopback") {
            return new my.TransportLoopback();
        }else {
            return new my.Transport({
                node_id: node_id,
                connection_object: myclass._createConnection(transport_id)
            });
        }
    };
    myclass._createConnection = function(transport_id) {
        if(transport_id === "local") {
            if(!local_server) {
                local_server = new my.ServerLocal();
            }
            return new my.ConnectionLocal(local_server);
        }else if(transport_id.match(/^wss?:\/\//)) {
            return new my.ConnectionWebSocket(transport_id);
        }
        throw "Unknown transport_id: " + transport_id;
    };
    myclass.releaseLocalServer = function() {
        if(my.defined(local_server)) {
            local_server.release();
        }
        local_server = undefined;
    };
    myclass.prototype = {
        _createRemoteSelector: function(remote_node_id, target) {
            var self = this;
            var args = {
                transport: self.transport,
                node_id: remote_node_id,
            };
            if(target === window) {
                args.eval_code = "$(window)";
            }else if(target === document) {
                args.eval_code = "$(document)";
            }else if($.isPlainObject(target) && my.defined(target.remote_type)) {
                // if target is a remote DOM Pointer object...
                if(target.remote_type === "xpath") {
                    args.xpath = target.remote_xpath;
                    if(my.defined(target.remote_node_id)) {
                        args.node_id = target.remote_node_id;
                    }
                }else {
                    throw "Unknown remote pointer type: " + target.remote_type;
                }
            }else {
                args.selector = "" + target;
            }
            return new my.RemoteSelector(args);
        },
        /**
         * @callback jQluster.RemoteSelectorFactory~ReadinessCallback
         *
         * @param {jQluster.RemoteSelectorFactory} factory - the
         * factory object it belongs to.
         *
         * @desc A callback function that is called when the specified
         * remote node is ready for jQluster.
         */
        /**
         * @typedef {function} jQluster.RemoteSelectorFactory~RemoteJQuery
         *
         * @param
         * {string|window|document|jQluster.Transport~RemoteDOMPointer|jQluster.RemoteSelectorFactory~ReadinessCallback}
         * target - If function, it is interpreted as a callback
         * function that is called when the remote node is ready for
         * jQluster. Otherwise, it is interpreted as a selector.
         *
         * @returns {jQluster.RemoteSelector|nothing} If `target` is a
         * function, it returns nothing.  Otherwise it returns a
         * RemoteSelector following the rule below.
         *
         * - If `target` is a string: `target` is interpreted as
         *   jQuery selector string. It returns the RemoteSelector for
         *   that selector.
         * - If `target` is a RemoteDOMPointer: It returns the RemoteSelector specified by the pointer.
         * - If `target` is the `window`: It returns the RemoteSelector for `$(window)`.
         * - If `target` is the `document`: It returns the RemoteSelector for `$(document)`.
         *
         * @desc A generator of {@link jQluster.RemoteSelector}s that
         * is tied to a specific node. This is similar to `jQuery`
         * object.
         */
        /**
         * Create a function that generates {@link
         * jQluster.RemoteSelector}s on the specified remote Node.
         *
         * @param {string} remote_node_id - The target remote Node ID.
         *
         * @param
         * {string|jQluster.RemoteSelectorFactory~ReadinessCallback}
         * [immediate_target=undefined] - If set, it is equivalent to
         * `forRemoteNode(remote_node_id)(immediate_target)`.
         *
         * @returns {jQluster.RemoteSelectorFactory~RemoteJQuery|any} If
         * `immediate_target` is not specified, it returns a generator
         * function of RemoteSelectors.
         */
        forRemoteNode: function(remote_node_id, immediate_target) {
            var self = this;
            var factory = function(target) {
                if($.isFunction(target)) {
                    self.readiness_callback_manager.listenToRemoteReadiness(
                        remote_node_id, function() { target(factory); }
                    );
                }else {
                    return self._createRemoteSelector(remote_node_id, target);
                }
            };
            if(my.defined(immediate_target)) {
                return factory(immediate_target);
            }else {
                return factory;
            }
        },
        /**
         * Safely releases the resource it keeps.
         * @returns nothing.
         */
        release: function() {
            if(my.defined(this.transport)) {
                this.transport.release();
                this.transport = null;
            }
            this.readiness_callback_manager = null;
        },
    };
})(jQluster, jQuery);

"use strict";

/**
 * @file jquery_adaptor.js is a thin wrapper for {@link
 * jQluster.RemoteSelectorFactory}. It maintains a singleton of
 * RemoteSelectorFactory, and creates interface to it in jQuery
 * namespace.
 *
 * @author Toshio Ito
 * @requires jQuery
 * @requires RemoteSelectorFactory.js
 */

/**
 * @external jQuery
 * @see {@link http://jquery.com}
 */

(function(my, $) {
    var factory = null;
    /**
     * @namespace {function} external:jQuery.jqluster
     *
     * @desc jQuery.jqluster is a function as well as a namespace. As
     * a function, it's equivalent to {@link
     * jQluster.RemoteSelectorFactory#forRemoteNode} method on the
     * singleton RemoteSelectorFactory.
     *
     * @example
     * // Initialize the local node as "Alice".
     * $.jqluster.init("Alice", "ws://example.com/jqluster");
     * 
     * // Get the remote jQuery on the node Bob.
     * var $bob = $.jqluster("Bob");
     * 
     * $bob(function() {
     *     console.log("Bob is ready");
     *     $bob("#some-box").text("Detected Bob is ready");
     * });
     */
    $.jqluster = function(remote_node_id, selector) {
        if(!my.defined(factory)) {
            throw "call $.jqluster.init() first.";
        }
        return factory.forRemoteNode(remote_node_id, selector);
    };
    /**
     * @function external:jQuery.jqluster.init
     *
     * @desc Initialize the singleton RemoteSelectorFactory
     * object.
     *
     * @param {string} my_node_id - The Node ID of the local node.
     *
     * @param {string} transport_id - The transport ID for creating
     * RemoteSelectors.
     *
     * @param {Object} [options={}] - Other options that are passed to
     * the constructor of {@link jQluster.RemoteSelectorFactory}.
     *
     * @see {@link jQluster.RemoteSelectorFactory}
     */
    $.jqluster.init = function(my_node_id, transport_id, options) {
        if(my.defined(factory)) return;
        if(!my.defined(options)) options = {};
        factory = new my.RemoteSelectorFactory($.extend({}, options, {
            node_id: my_node_id, transport_id: transport_id
        }));
    };
    /**
     * @function external:jQuery.jqluster.release
     *
     * @desc Equvalent to {@link jQluster.RemoteSelectorFactory#release}
     * method on the singleton RemoteSelectorFactory.
     */
    $.jqluster.release = function() {
        if(my.defined(factory)) {
            factory.release();
            factory = null;
        }
    };
})(jQluster, jQuery);



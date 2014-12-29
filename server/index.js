/*
 Copyright (c) 2014 clowwindy

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the 'Software'), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */

var net = require('net'),
    _ = require('lodash'),
    Promise = require('bluebird'),

    udpRelay = require('./../lib/udprelay'),
    libUtils = require('./../lib/utils'),
    utils = require('../utils'),
    netListener = require('./netListener');

var connections = 0,

// TODO deal with this later


    serverFactory = function (config, key, port, aServerIp) {
        var PORT, server, serverIp;
        PORT = _.cloneDeep(port);
        serverIp = _.cloneDeep(aServerIp);
        libUtils.info('calculating ciphers for port ' + PORT);
        connections += 1;
        server = net.createServer(function (connection) {
            netListener(connection, key, config.method, config.timeout, connections);
        });
        server.listen(PORT, serverIp, function () {
            return libUtils.info('server listening at ' + serverIp + ':' + PORT + ' ');
        });
        udpRelay.createServer(serverIp, PORT, null, null, key, config.METHOD, config.timeout, false);
        server.on('error', function (e) {
            if (e.code === 'EADDRINUSE') {
                libUtils.error('Address in use, aborting');
            } else {
                libUtils.error(e);
            }
            return process.stdout.on('drain', function () {
                return process.exit(1);
            });
        });
        return server;
    },

// TODO remove this place holder
    varend = 'end';

exports.main = function () {
    utils.readConfig.server()
        .then(function (config) {
            var _results = [];
            // TODO remove all of these then refactor is done
            var servers = config.servers, portPassword = config.portPassword;

            for (var port in portPassword) {
                if (!portPassword.hasOwnProperty(port)) {
                    continue;
                }
                var key = portPassword[port];
                var _results1 = [];
                for (var _i = 0; _i < servers.length; _i += 1) {
                    var aServerIp = servers[_i];
                    var server = serverFactory(config, key, port, aServerIp);
                    _results1.push(server);
                }
                _results.push(_results1);
            }
            return _results;
        });
};

if (require.main === module) {
    exports.main();
}

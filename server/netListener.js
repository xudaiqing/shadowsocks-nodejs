/**
 * Created by xudaiqing on 2014/12/29.
 */

var _ = require('lodash'),
    net = require('net'),

    libUtils = require('./../lib/utils'),
    inet = require('./../lib/inet'),
    Encryptor = require('./../lib/encrypt').Encryptor,

netListener = function (connection, KEY, METHOD, timeout, connectionCount) {
    var addrLen, cachedPieces, clean, encryptor, headerLength, remote, remoteAddr, remotePort, stage;

    encryptor = new Encryptor(_.cloneDeep(KEY), METHOD);
    stage = 0;
    headerLength = 0;
    remote = null;
    cachedPieces = [];
    addrLen = 0;
    remoteAddr = null;
    remotePort = null;
    libUtils.debug('connections: ' + connectionCount);
    clean = function () {
        libUtils.debug('clean');
        connectionCount -= 1;
        remote = null;
        connection = null;
        encryptor = null;
        return libUtils.debug('connections: ' + connectionCount);
    };
    connection.on('data', function (data) {
        var addrtype, buf;
        libUtils.log(libUtils.EVERYTHING, 'connection on data');
        try {
            data = encryptor.decrypt(data);
        } catch (_error) {
            var e = _error;
            libUtils.error(e);
            if (remote) {
                remote.destroy();
            }
            if (connection) {
                connection.destroy();
            }
            return;
        }
        if (stage === 5) {
            if (!remote.write(data)) {
                connection.pause();
            }
            return;
        }
        if (stage === 0) {
            try {
                addrtype = data[0];
                if (addrtype === void 0) {
                    return;
                }
                if (addrtype === 3) {
                    addrLen = data[1];
                } else if (addrtype !== 1 && addrtype !== 4) {
                    libUtils.error('unsupported addrtype: ' + addrtype + ' maybe wrong password');
                    connection.destroy();
                    return;
                }
                if (addrtype === 1) {
                    remoteAddr = libUtils.inetNtoa(data.slice(1, 5));
                    remotePort = data.readUInt16BE(5);
                    headerLength = 7;
                } else if (addrtype === 4) {
                    remoteAddr = inet.inet_ntop(data.slice(1, 17));
                    remotePort = data.readUInt16BE(17);
                    headerLength = 19;
                } else {
                    remoteAddr = data.slice(2, 2 + addrLen).toString('binary');
                    remotePort = data.readUInt16BE(2 + addrLen);
                    headerLength = 2 + addrLen + 2;
                }
                connection.pause();
                remote = net.connect(remotePort, remoteAddr, function () {
                    var i, piece;
                    libUtils.info('connecting ' + remoteAddr + ':' + remotePort);
                    if (!encryptor || !remote || !connection) {
                        if (remote) {
                            remote.destroy();
                        }
                        return;
                    }
                    i = 0;
                    connection.resume();
                    while (i < cachedPieces.length) {
                        piece = cachedPieces[i];
                        remote.write(piece);
                        i += 1;
                    }
                    cachedPieces = null;
                    remote.setTimeout(timeout, function () {
                        libUtils.debug('remote on timeout during connect()');
                        if (remote) {
                            remote.destroy();
                        }
                        if (connection) {
                            return connection.destroy();
                        }
                    });
                    stage = 5;
                    return libUtils.debug('stage = 5');
                });
                remote.on('data', function (data) {
                    libUtils.log(libUtils.EVERYTHING, 'remote on data');
                    if (!encryptor) {
                        if (remote) {
                            remote.destroy();
                        }
                        return;
                    }
                    data = encryptor.encrypt(data);
                    if (!connection.write(data)) {
                        return remote.pause();
                    }
                });
                remote.on('end', function () {
                    libUtils.debug('remote on end');
                    if (connection) {
                        return connection.end();
                    }
                });
                remote.on('error', function (e) {
                    libUtils.debug('remote on error');
                    return libUtils.error('remote ' + remoteAddr + ':' + remotePort + ' error: ' + e);
                });
                remote.on('close', function (hadError) {
                    libUtils.debug('remote on close:' + hadError);
                    if (hadError) {
                        if (connection) {
                            return connection.destroy();
                        }
                    } else {
                        if (connection) {
                            return connection.end();
                        }
                    }
                });
                remote.on('drain', function () {
                    libUtils.debug('remote on drain');
                    if (connection) {
                        return connection.resume();
                    }
                });
                remote.setTimeout(15 * 1000, function () {
                    libUtils.debug('remote on timeout during connect()');
                    if (remote) {
                        remote.destroy();
                    }
                    if (connection) {
                        return connection.destroy();
                    }
                });
                if (data.length > headerLength) {
                    buf = new Buffer(data.length - headerLength);
                    data.copy(buf, 0, headerLength);
                    cachedPieces.push(buf);
                    buf = null;
                }
                stage = 4;
                return libUtils.debug('stage = 4');
            } catch (_error) {
                var e = _error;
                libUtils.error(e);
                connection.destroy();
                if (remote) {
                    return remote.destroy();
                }
            }
        } else {
            if (stage === 4) {
                return cachedPieces.push(data);
            }
        }
    });
    connection.on('end', function () {
        libUtils.debug('connection on end');
        if (remote) {
            return remote.end();
        }
    });
    connection.on('error', function (e) {
        libUtils.debug('connection on error');
        return libUtils.error('local error: ' + e);
    });
    connection.on('close', function (hadError) {
        libUtils.debug('connection on close:' + hadError);
        if (hadError) {
            if (remote) {
                remote.destroy();
            }
        } else {
            if (remote) {
                remote.end();
            }
        }
        return clean();
    });
    connection.on('drain', function () {
        libUtils.debug('connection on drain');
        if (remote) {
            return remote.resume();
        }
    });
    return connection.setTimeout(timeout, function () {
        libUtils.debug('connection on timeout');
        if (remote) {
            remote.destroy();
        }
        if (connection) {
            return connection.destroy();
        }
    });
};

module.exports = netListener;

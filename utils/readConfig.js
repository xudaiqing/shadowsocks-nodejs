/**
 * Created by xudaiqing on 2014/12/29.
 */
var fs = require('fs'),
    path = require('path'),
    Promise = require('bluebird'),
    libUtils = require('./../lib/utils'),

    readConfigFile = function () {
        return Promise.try(function () {
            var configContent, configFromArgs, configPath, k, config, v, e;
            console.log(libUtils.version);
            configFromArgs = libUtils.parseArgs(true);
            configPath = 'config.json';
            if (configFromArgs.config_file) {
                configPath = configFromArgs.config_file;
            }
            if (!fs.existsSync(configPath)) {
                configPath = path.resolve(__dirname, 'config.json');
                if (!fs.existsSync(configPath)) {
                    configPath = path.resolve(__dirname, '../../config.json');
                    if (!fs.existsSync(configPath)) {
                        configPath = null;
                    }
                }
            }
            if (configPath) {
                libUtils.info('loading config from ' + configPath);
                configContent = fs.readFileSync(configPath);
                try {
                    config = JSON.parse(configContent);
                } catch (_error) {
                    e = _error;
                    libUtils.error('found an error in config.json: ' + e.message);
                    process.exit(1);
                }
            } else {
                config = {};
            }
            for (k in configFromArgs) {
                if (!configFromArgs.hasOwnProperty(k)) {
                    continue;
                }
                v = configFromArgs[k];
                config[k] = v;
            }
            if (config.verbose) {
                libUtils.config(libUtils.DEBUG);
            }
            libUtils.checkConfig(config);
            return config;
        });
    },

    serverConfigPrep = Promise.method(function (config) {
        var Config = {};
        Config.portPassword = config.port_password;
        Config.port = config.server_port;
        Config.key = config.password;
        Config.SERVER = config.server;
        if (!(Config.SERVER && (Config.port || Config.portPassword) && Config.key)) {
            libUtils.warn('config.json not found, you have to specify all config in commandline');
            process.exit(1);
        }

        if (Config.portPassword) {
            if (Config.port || Config.key) {
                libUtils.warn('warning: port_password should not be used with server_port and password. server_port and password will be ignored');
            }
        } else {
            Config.portPassword = {};
            Config.portPassword[Config.port.toString()] = Config.key;
        }
        var servers = Config.SERVER;
        if (!(servers instanceof Array)) {
            servers = [servers];
        }
        var serverConfig = {};
        serverConfig.servers = servers;
        serverConfig.portPassword = Config.portPassword;
        serverConfig.method = config.method;
        serverConfig.timeout = Math.floor(config.timeout * 1000) || 300000;
        return serverConfig;
    });

module.exports.server = function(){
    return readConfigFile().then(serverConfigPrep);
};

import * as Express from "express";
import * as Fs from "fs";
import * as Http from "http";
import * as Logger from "logger";
import * as Server from "./src/server";
import * as Shortid from "shortid";
import * as Yaml from "js-yaml";
import * as Yargs from "yargs";

const CONFIG_FILE = 'config.yaml';


function default_conf()
{
    let conf = Yaml.safeLoad(
        Fs.readFileSync( CONFIG_FILE, 'utf8' ),
        {
            filename: CONFIG_FILE
        }
    );

    let argv = Yargs.command(
        "port"
        ,"Port to listen on"
        ,{
            description: "Port to listen on"
            ,alias: "p"
            ,type: "number"
        }
    ).argv;
    if( argv.port ) {
        conf.port = argv.port;
    }

    return conf;
}

function make_logger( logger )
{
    let request_id = Shortid.generate();
    let log_func = function (level, args) {
        let date = new Date();
        args.unshift( "(" + request_id + ")" );
        args.unshift( "[" + date.toISOString() + "]" );
        return logger[level]( ...args );
    };

    let request_logger = {
        fatal: function(...args) { log_func( "fatal", args ) }
        ,error: function(...args) { log_func( "error", args ) }
        ,warn: function(...args) { log_func( "warn", args ) }
        ,info: function(...args) { log_func( "info", args ) }
        ,debug: function(...args) { log_func( "debug", args ) }
    };

    return request_logger;
}


let httpServer;
let logger;
export function start(
    conf?: Object
): Promise<void>
{
    if(! conf) conf = default_conf();

    logger = Logger.createLogger( conf["log_file"] );

    // Fix hanging connections for certain external requests. See:
    // https://stackoverflow.com/questions/16965582/node-js-http-get-hangs-after-5-requests-to-remote-site
    Http.globalAgent.maxSockets = 1000;
    let port = conf["port"];

    return new Promise( (resolve, reject) => {
        let express = Express();
        Server.makeRoutes( express );

        httpServer = Http.createServer( express );
        logger.info( `Starting server on port ${port}` );
        httpServer.listen( port );
        resolve();
    });
}

export function stop(): Promise<void>
{
    return new Promise( (resolve, reject) => {
        httpServer.close( () => {
            logger.info( "Closed server" );
            resolve();
        });
    });
}

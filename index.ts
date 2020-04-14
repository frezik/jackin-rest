import * as Express from "express";
import * as Fs from "fs";
import * as Http from "http";
import * as Logger from "logger";
import * as Nano from "nano";
import * as Server from "./src/server";
import * as Yaml from "js-yaml";
import * as Yargs from "yargs";


const CONFIG_FILE = 'config.yaml';
export let CONF;


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

function default_couchdb( conf: {
    username: string
    ,password: string
    ,base_url: string
    ,database: string
})
{
    const url = new URL( conf.base_url );
    url.username = conf.username;
    url.password = conf.password;

    const nano = Nano( url.toString() );
    const jackin = nano.db.use( conf.database );

    return jackin;
}


let httpServer;
let logger;
export function start(
    conf?: Object
    ,couchdb_callback?: () => any
): Promise<void>
{
    if(! conf) conf = default_conf();
    if(! couchdb_callback ) couchdb_callback = () => {
        default_couchdb({
            username: conf["couchdb"]["username"]
            ,password: conf["couchdb"]["password"]
            ,base_url: conf["couchdb"]["base_url"]
            ,database: conf["couchdb"]["database"]
        });
    };

    CONF = conf;
    logger = Logger.createLogger( conf["log_file"] );

    // Fix hanging connections for certain external requests. See:
    // https://stackoverflow.com/questions/16965582/node-js-http-get-hangs-after-5-requests-to-remote-site
    Http.globalAgent.maxSockets = 1000;
    let port = conf["port"];

    const db = couchdb_callback();

    return new Promise( (resolve, reject) => {
        let express = Express();
        Server.init({
            server: express
            ,logger: logger
            ,auth_config: conf["auth"]
        });

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

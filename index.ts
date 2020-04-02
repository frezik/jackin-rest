import * as Express from 'express';
import * as Fs from "fs";
import * as Http from "http";
import * as Server from './src/server';
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


let httpServer;
export function start(
    conf?: Object
): Promise<void>
{
    if(! conf) conf = default_conf();

    // Fix hanging connections for certain external requests. See:
    // https://stackoverflow.com/questions/16965582/node-js-http-get-hangs-after-5-requests-to-remote-site
    Http.globalAgent.maxSockets = 1000;
    let port = conf["port"];

    return new Promise( (resolve, reject) => {
        let express = Express();
        Server.makeRoutes( express );

        httpServer = Http.createServer( express );
        httpServer.listen( port );
        resolve();
    });
}

export function stop(): Promise<void>
{
    return new Promise( (resolve, reject) => {
        httpServer.close( () => {
            resolve();
        });
    });
}

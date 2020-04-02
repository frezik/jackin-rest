import * as JackinREST from '../index';
import * as Fs from 'fs';
import * as Nano from "nano";
import * as Shortid from 'shortid';
import { v1 as Uuid } from 'uuid';
import * as Tap from 'tap';
import * as Yaml from 'js-yaml';


let PORT = 3000;
const CONFIG_FILE = "config.yaml";
let DB;

function setup_couchdb( couchdb_conf: {
    username: string
    ,password: string
    ,base_url: string
}): Promise<any>
{
    const url = new URL( couchdb_conf.base_url );
    url.username = couchdb_conf.username;
    url.password = couchdb_conf.password;

    let id = Uuid();
    const db_name = "jackin-test-" + id;
    Tap.comment( `Using Jackin database <${db_name}>` );

    const nano = Nano( url.toString() );

    return new Promise( (resolve, reject) => {
        DB = nano.db.create( db_name );
        resolve( DB );
    });
}

function fetch_couchdb()
{
    return DB;
}


export function startServer(): Promise<string>
{
    return new Promise( (resolve, reject) => {
        Fs.readFile( CONFIG_FILE, 'utf8', ( err, data ) => {
            if( err ) throw err;

            const conf = Yaml.safeLoad( data, {
                filename: CONFIG_FILE
            });

            setup_couchdb({
                username: conf["couchdb"]["username"]
                ,password: conf["couchdb"]["password"]
                ,base_url: conf["couchdb"]["base_url"]
            }).then( () => {
                return JackinREST.start({
                    port: PORT
                    ,log_file: "test.log"
                }, fetch_couchdb )
            }).then( () => {
                resolve( `http://localhost:${PORT}` );
            });
        });
    });
}

export function stopServer(): Promise<void>
{
    return JackinREST.stop();
}

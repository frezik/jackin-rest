import * as JackinREST from '../index';
import * as JackinDB from '../src/db';
import * as Fs from 'fs';
import * as Nano from "nano";
import * as Shortid from 'shortid';
import { v1 as Uuid } from 'uuid';
import * as Tap from 'tap';
import * as Yaml from 'js-yaml';


let PORT = 3000;
const CONFIG_FILE = "config.yaml";
let DB: Nano.DatabaseScope;
let db_uuid: string;

function setup_couchdb( couchdb_conf: {
    username: string
    ,password: string
    ,base_url: string
}): Promise<void>
{
    const url = new URL( couchdb_conf.base_url );
    url.username = couchdb_conf.username;
    url.password = couchdb_conf.password;

    db_uuid = Uuid();
    Tap.comment( `Using UUID for Jackin databases <${db_uuid}>` );

    const nano = Nano( url.toString() );

    return new Promise( (resolve, reject) => {
        DB = nano.db;

        JackinDB.init( DB
            ,( name: string ): Nano.DocumentScope<any> => {
                const full_name = name + "-" + db_uuid;
                return DB.use( full_name );
            }
        );
        resolve();
    });
}

export function create_db(
    name: string
): Promise<any>
{
    const full_name = name + "-" + db_uuid;
    Tap.comment( `Creating database [${full_name}]` );
    return new Promise( (resolve, reject) => {
        DB
            .create( full_name )
            .then( (response) => {
                if( response.ok ) {
                    Tap.comment(
                        `Successfully created database [${full_name}]` );
                    resolve( DB.use( full_name ) );
                }
                else {
                    Tap.comment( `Response failed: ${response}` );
                    reject( response.reason );
                }
            });
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

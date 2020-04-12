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
let DB: Nano.ServerScope;
let db_uuid: string;

let conf;
function initConf(): Promise<any>
{
    if( conf ) {
        return new Promise( (resolve, reject) => {
            resolve( conf );
        });
    }
    else {
        return new Promise( (resolve, reject) => {
            Fs.readFile( CONFIG_FILE, 'utf8', ( err, data ) => {
                if( err ) throw err;

                conf = Yaml.safeLoad( data, {
                    filename: CONFIG_FILE
                });

                // Override parts for tests
                conf.port = PORT;
                conf.auth.preferred_method = "bcrypt";
                conf.auth.method_args = 1;
                resolve( conf );
            })
        });
    }
}

export function setupCouchDB(): Promise<void>
{
    return new Promise( (resolve, reject) => {
        initConf().then( (conf) => {
            const url = new URL( conf.couchdb.base_url );
            url.username = conf.couchdb.username;
            url.password = conf.couchdb.password;

            db_uuid = Uuid();
            Tap.comment( `Using UUID for Jackin databases <${db_uuid}>` );

            DB = Nano( url.toString() );
            JackinDB.init(
                DB
                ,url
                ,( name: string ): string => {
                    const full_name = name + "-" + db_uuid;
                    return full_name;
                }
            );

            resolve();
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
        setupCouchDB().then( () => {
            return initConf()
        }).then( (conf) => {
            return JackinREST.start( conf, fetch_couchdb );
        }).then( () => {
            resolve( `http://localhost:${PORT}` );
        });
    });
}

export function stopServer(): Promise<void>
{
    return JackinREST.stop();
}

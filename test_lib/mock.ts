import Auth from '../src/db/auth';
import Castle from 'castellated';
import * as Jackin from 'jackin';
import * as JackinREST from '../index';
import * as JackinDB from '../src/db';
import * as Fs from 'fs';
import * as MockDevice from '../test_lib/mock_device';
import * as Nano from "nano";
import * as Shortid from 'shortid';
import { v1 as Uuid } from 'uuid';
import * as Superagent from 'superagent';
import * as Tap from 'tap';
import User from '../src/db/user';
import * as Yaml from 'js-yaml';

const plain_encoder = new Castle.Plaintext();


let PORT;
const CONFIG_FILE = "config.yaml";
const GOOD_USERNAME = "foo";
const GOOD_PASSWORD = "bar";
let DB: Nano.ServerScope;
let db_uuid: string;

let conf;
function initConf(
    port?: number
): Promise<any>
{
    if( conf ) {
        return new Promise( (resolve, reject) => {
            resolve( conf );
        });
    }
    else {
        PORT = port;

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


export function startServer( args: {
    auth_token_sec_timeout?: number
    ,port: number
    ,device?: Jackin.Device
}): Promise<string>
{
    if(! args.device) args.device = new MockDevice.Device();

    return new Promise( (resolve, reject) => {
        initConf( args.port ).then( (conf) => {
            setupCouchDB();
        }).then( () => {
            return initConf();
        }).then( (conf) => {
            if( args.auth_token_sec_timeout ) {
                conf.auth_token_sec_timeout = args.auth_token_sec_timeout;
            }

            return JackinREST.start(
                args.device
                ,conf
                ,fetch_couchdb
            );
        }).then( () => {
            resolve( `http://localhost:${PORT}` );
        });
    });
}

export function setupAuth(
    baseurl: string
): Promise<string>
{
    return new Promise( (resolve, reject) => {
        Promise.all([
            User.initDB()
            ,Auth.initDB()
        ]).then( () => {
            return plain_encoder
                .encode( GOOD_PASSWORD )
                .then( (encoded_password) => {
                    const id = Uuid();
                    const user = new User(
                        GOOD_USERNAME
                        ,encoded_password.toString()
                    );
                    return user.insert();
                });
        }).then( () => {
            Tap.comment( "Sending auth request" );
            return Superagent
                .post( `${baseurl}/auth` )
                .auth( GOOD_USERNAME, GOOD_PASSWORD );
        }).then( (res) => {
            if( 200 != res.statusCode ) throw "Could not authenticate, bailing";
            resolve( res.body.token );
        });
    });
}

export function stopServer(): Promise<void>
{
    return JackinREST.stop();
}

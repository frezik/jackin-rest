import * as JackinREST from '../index';
import * as Fs from 'fs';
import * as Yaml from 'js-yaml';


let PORT = 3000;
const CONFIG_FILE = "config.yaml";

export function startServer(): Promise<string>
{
    return new Promise( (resolve, reject) => {
        Fs.readFile( CONFIG_FILE, 'utf8', ( err, data ) => {
            if( err ) throw err;

            const conf = Yaml.safeLoad( data, {
                filename: CONFIG_FILE
            });

            JackinREST.start({
                port: PORT
                ,log_file: "test.log"
                ,couchdb: conf["couchdb"]
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

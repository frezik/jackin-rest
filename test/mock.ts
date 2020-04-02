import * as JackinREST from '../index';


let PORT = 3000;

export function startServer(): Promise<string>
{
    return new Promise( (resolve, reject) => {
        JackinREST.start({
            port: PORT
            ,log_file: "test.log"
        }).then( () => {
            resolve( `http://localhost:${PORT}` );
        });
    });
}

export function stopServer(): Promise<void>
{
    return JackinREST.stop();
}

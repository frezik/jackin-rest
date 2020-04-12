import * as BasicAuth from 'basic-auth';
import Castle from 'castellated';
import * as Crypto from 'crypto';
import * as JackinDB from './db';
import * as Shortid from 'shortid';
import User from './db/user';


const AUTH_TOKEN_BYTES = 32;


let castle: Castle;

type auth_params = {
    preferred_method: string
    ,method_args: string
};


export function init( args: {
    server: any
    ,logger: any
    ,auth_config: auth_params
}): void
{
    castle = makeCastle( args.auth_config );
    args.server.use( makeLogger( args.logger ) );
    makeRoutes( args.server );
}

function castle_fetch_callback(
    username: string
): Promise<string>
{
    return new Promise( (resolve, reject) => {
        User.getByEmail( username ).then( (user) => {
            resolve( user.password );
        });
    });
}

function castle_update_callback(
    username: string
    ,password: string
): Promise<void>
{
    return new Promise( (resolve, reject) => {
        User.getByEmail( username ).then( (user) => {
            user.password = password;
            return user.update();
        }).then( () => {
            resolve();
        });
    });
}

function castle_add_user_callback(
    username: string
    ,password: string
): Promise<void>
{
    return new Promise( (resolve, reject) => {
        let user = new User(
            username
            ,password
        );
        user.insert().then( () => {
            resolve();
        });
    });
}

function makeCastle(
    args: auth_params
): Castle
{
    let castle = new Castle(
        args.preferred_method
        ,args.method_args
        ,castle_fetch_callback
        ,castle_update_callback
        ,castle_add_user_callback
    );

    return castle;
}

function makeLogger( logger )
{
    return (req, res, next) => {
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

        request_logger.info( "Request to " + req.path );
        req.logger = request_logger;
        next();
    };
}

function makeRoutes( server ): void
{
    server.get( '/', homeRoute );
    server.post( '/auth', authRoute );
}


//
// Route functions below
//

function homeRoute( req, res )
{
    req.logger.info( 'Called home route' );
    res.sendStatus( 200 );
}

function authRoute( req, res )
{
    req.logger.info( "Called auth route" );
    const auth = BasicAuth( req );
    const unauthorized_callback = () => {
        res.sendStatus( 401 );
    };

    if( auth ) {
        const user = auth['name'];
        const pass = auth['pass'];
        req.logger.info( "User logging in: " + user );

        castle
            .match( user, pass )
            .then( (is_matched) => {
                if( is_matched ) {
                    req.logger.info( `User '${user}' is now logged in` );
                    Crypto.randomBytes( AUTH_TOKEN_BYTES, (err, buf) => {
                        if( err ) {
                            throw err;
                        }
                        const token = buf.toString( 'hex' );
                        // TODO save string, with timestamp for expiration
                        res
                            .status( 200 )
                            .json({
                                token: token
                            });
                    });
                }
                else {
                    req.logger.info( `User '${user}' login had bad password` );
                    unauthorized_callback();
                }
            }).catch( (err) => {
                req.logger.error( "Error logging in: " + err );

                if( err.match( /not found/i ) ) {
                    // User not found, send unauthorized response
                    unauthorized_callback();
                }
                else {
                    // Unknown error
                    res.sendStatus( 500 );
                }
            });
    }
    else {
        unauthorized_callback();
    }
}

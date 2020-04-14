import Auth from './db/auth';
import * as BasicAuth from 'basic-auth';
import Castle from 'castellated';
import * as Crypto from 'crypto';
import * as JackinDB from './db';
import * as Moment from 'moment';
import * as Shortid from 'shortid';
import User from './db/user';


const AUTH_TOKEN_BYTES = 32;

// Routes that are allowed without a valid auth token
const AUTH_TOKEN_WHITELIST = {
    "GET /": true
    ,"POST /auth": true
};


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
    args.server.use( authTokenCheck );
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
    server.get( '/auth', authCheckRoute );
}

function authTokenCheck( req, res, next ): void
{
    // First, check whitelist
    const method = req.method;
    const path = req.path;
    const check_string = method + " " + path;

    if( AUTH_TOKEN_WHITELIST[check_string] ) {
        next();
    }
    else {
        // Not on whitelist, check for token
        const auth_header = req.get( 'Authorization' );
        const auth_components = auth_header.split( " " );

        if( (1 < auth_components.length)
            && ("Bearer" == auth_components[0])
        ) {
            const auth_token = auth_components[1];
            Auth.isTokenOK( auth_token ).then( (is_ok) => {
                if( is_ok ) {
                    req.logger.info( "Token is authorized" );
                    next();
                }
                else {
                    req.logger.info( "Token is not authorized" );
                    res.sendStatus( 401 );
                }
            }).catch( (err) => {
                req.logger.error( "Error: " + err );
                res.sendStatus( 500 );
            });
        }
        else {
            req.logger.error(
                "Client did not send correct authorization header" );
            res.sendStatus( 401 );
        }
    }
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

                        const auth = new Auth(
                            token
                            ,Moment()
                        );
                        auth.insert().then( () => {
                            res
                                .status( 200 )
                                .json({
                                    token: token
                                });
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

function authCheckRoute( req, res )
{
    req.logger.info( "Called auth check route" );
    res.sendStatus( 200 );
}

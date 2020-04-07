import * as BasicAuth from 'basic-auth';
import * as JackinDB from './db';
import * as Shortid from 'shortid';



export function init( args: {
    server: any
    ,logger: any
}): void
{
    args.server.use( makeLogger( args.logger ) );
    makeRoutes( args.server );
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
        req.sendStatus( 401 );
    };

    if( auth ) {
        const user = auth['name'];
        const pass = auth['pass'];

        JackinDB
            .fetchDB( JackinDB.AUTH_DB_NAME )
            .then( (db) => {
                return db.find({
                    limit: 1
                    ,selector: {
                        email: [ user ]
                    }
                    ,fields: [ "email", "password" ]
                });
            })
            .then( (auth) => {
                // TODO check with castellated
            });
    }
    else {
        unauthorized_callback();
    }
}

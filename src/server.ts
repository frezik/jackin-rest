import Auth from './db/auth';
import * as BasicAuth from 'basic-auth';
import * as BodyParser from 'body-parser';
import Castle from 'castellated';
import * as Crypto from 'crypto';
import * as Jackin from 'jackin';
import * as JackinDB from './db';
import * as JackinREST from '../index';
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
    args.server.use( BodyParser.json() );
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
    server.get( '/device', fetchDevicesRoute );
    server.get( '/device/:header', fetchDeviceHeaderRoute );
    server.get( '/device/:header/:pin/mode', fetchPinModeRoute );
    server.put( '/device/:header/:pin/mode', setPinModeRoute );
    server.get( '/device/:header/:pin/value', fetchPinValueRoute );
    server.put( '/device/:header/:pin/value', setPinValueRoute );
    server.get( '/device/:header/:pin/pullup', fetchPinPullupRoute );
    server.put( '/device/:header/:pin/pullup', setPinPullupRoute );
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

function fetchDevicesRoute( req, res )
{
    req.logger.info( "Called devices route" );
    res
        .status( 200 )
        .send([
            '/v1/device/1'
        ]);
}

async function fetchDeviceHeaderRoute( req, res )
{
    req.logger.info( "Called device header route" );
    const device_num = req.params[ 'header' ];
    const device = JackinREST.DEVICE;
    const max_pin_num = device.maxPinNum();

    const pins = [];
    for( let i = 1; i <= max_pin_num; i++ ) {
        let pin = device.getPin( i );
        const base_url = `/v1/device/${device_num}/${i}`;

        let pin_data = {
            base_url: base_url
        };

        if( pin.hasOwnProperty( 'power' ) ) {
            pin_data[ 'power' ] = pin.power.voltage;
        }
        else if( pin.hasOwnProperty( 'gpio' ) ) {
            pin_data[ 'set_mode' ] = base_url + "/mode";
            pin_data[ 'value' ] = base_url + "/value";
            pin_data[ 'pullup' ] = base_url + "/pullup";

            const mode = await pin.gpio.getMode();
            const pullup = await pin.gpio.getPullup();
            const value =
                (mode == Jackin.Mode.read) ? await pin.gpio.getValue() :
                null; // If it's in write mode, or something unknown
            // TODO in write mode, value set from CouchDB, based on 
            // the last thing we set it to

            pin_data[ 'cur_mode' ] =
                (mode == Jackin.Mode.read) ? "read" :
                (mode == Jackin.Mode.write) ? "write" :
                null;
            pin_data[ 'cur_pullup' ] = 
                (pullup == Jackin.PullupMode.up) ? "up" :
                (pullup == Jackin.PullupMode.down) ? "down" :
                (pullup == Jackin.PullupMode.floating) ? "floating" :
                null;
            pin_data[ 'cur_value' ] = value;
        }
        // TODO ADC, I2C, PWM, SPI

        pins.push( pin_data );
    }

    res
        .status( 200 )
        .send( pins );
}

async function fetchPinModeRoute( req, res )
{
    req.logger.info( "Called pin mode route" );
    const device_num = req.params[ 'header' ];
    const pin_num = req.params[ 'pin' ];
    const device = JackinREST.DEVICE;
    const max_pin_num = device.maxPinNum();

    if( pin_num > max_pin_num ) {
        res.sendStatus( 404 );
        return;
    }

    const pin = device.getPin( pin_num );
    if(! pin.hasOwnProperty( 'gpio' ) ) {
        res
            .status( 400 )
            .send({
                msg: `Pin ${pin_num} is not a GPIO pin`
            });
        return;
    }

    const mode = await pin.gpio.getMode();
    const mode_str = 
        (mode == Jackin.Mode.read) ? "read" :
        (mode == Jackin.Mode.write) ? "write" :
        null;
    res.send({
        mode: mode_str
    });
}

async function setPinModeRoute( req, res )
{
    req.logger.info( "Called set pin mode route" );
    const device_num = req.params[ 'header' ];
    const pin_num = req.params[ 'pin' ];
    const device = JackinREST.DEVICE;
    const max_pin_num = device.maxPinNum();
    const wanted_mode = req.body[ 'mode' ];

    if( pin_num > max_pin_num ) {
        res.sendStatus( 404 );
        return;
    }

    const pin = device.getPin( pin_num );
    if(! pin.hasOwnProperty( 'gpio' ) ) {
        res
            .status( 400 )
            .send({
                msg: `Pin ${pin_num} is not a GPIO pin`
            });
        return;
    }

    if( 
        (wanted_mode != "read")
        && (wanted_mode != "write")
    ) {
        res
            .status( 400 )
            .send({
                msg: `Mode parameter must be "read" or "write"`
            });
        return;
    }

    const mode =
        (wanted_mode == "read") ? Jackin.Mode.read :
        (wanted_mode == "write") ? Jackin.Mode.write :
        Jackin.Mode.read; // How did we get here?

    await pin.gpio.setMode( mode );
    res.send({
        mode: wanted_mode
    });
}

async function fetchPinValueRoute( req, res )
{
    req.logger.info( "Called pin value route" );
    const device_num = req.params[ 'header' ];
    const pin_num = req.params[ 'pin' ];
    const device = JackinREST.DEVICE;
    const max_pin_num = device.maxPinNum();

    if( pin_num > max_pin_num ) {
        res.sendStatus( 404 );
        return;
    }

    const pin = device.getPin( pin_num );
    if(! pin.hasOwnProperty( 'gpio' ) ) {
        res
            .status( 400 )
            .send({
                msg: `Pin ${pin_num} is not a GPIO pin`
            });
        return;
    }

    const value = await pin.gpio.getValue();
    res.send({
        value: value
    });
}

async function setPinValueRoute( req, res )
{
    req.logger.info( "Called set pin mode route" );
    const device_num = req.params[ 'header' ];
    const pin_num = req.params[ 'pin' ];
    const device = JackinREST.DEVICE;
    const max_pin_num = device.maxPinNum();
    const wanted_value = req.body[ 'value' ];

    if( pin_num > max_pin_num ) {
        res.sendStatus( 404 );
        return;
    }

    const pin = device.getPin( pin_num );
    if(! pin.hasOwnProperty( 'gpio' ) ) {
        res
            .status( 400 )
            .send({
                msg: `Pin ${pin_num} is not a GPIO pin`
            });
        return;
    }

    // This forces the incoming value to be a boolean, no matter what the 
    // client sent us.
    const value =
        wanted_value ? true :
        wanted_value ? false :
        false;

    await pin.gpio.setValue( value );
    res.send({
        value: value
    });
}

async function fetchPinPullupRoute( req, res )
{
    req.logger.info( "Called pin pullup route" );
    const device_num = req.params[ 'header' ];
    const pin_num = req.params[ 'pin' ];
    const device = JackinREST.DEVICE;
    const max_pin_num = device.maxPinNum();

    if( pin_num > max_pin_num ) {
        res.sendStatus( 404 );
        return;
    }

    const pin = device.getPin( pin_num );
    if(! pin.hasOwnProperty( 'gpio' ) ) {
        res
            .status( 400 )
            .send({
                msg: `Pin ${pin_num} is not a GPIO pin`
            });
        return;
    }

    const pullup = await pin.gpio.getPullup();
    const pullup_str = 
        (pullup == Jackin.PullupMode.up) ? "up" :
        (pullup == Jackin.PullupMode.down) ? "down" :
        (pullup == Jackin.PullupMode.floating) ? "floating" :
        null;
    res.send({
        pullup: pullup_str
    });
}

async function setPinPullupRoute( req, res )
{
    req.logger.info( "Called set pin mode route" );
    const device_num = req.params[ 'header' ];
    const pin_num = req.params[ 'pin' ];
    const device = JackinREST.DEVICE;
    const max_pin_num = device.maxPinNum();
    const wanted_pullup = req.body[ 'pullup' ];

    if( pin_num > max_pin_num ) {
        res.sendStatus( 404 );
        return;
    }

    const pin = device.getPin( pin_num );
    if(! pin.hasOwnProperty( 'gpio' ) ) {
        res
            .status( 400 )
            .send({
                msg: `Pin ${pin_num} is not a GPIO pin`
            });
        return;
    }

    if(
        (wanted_pullup != "up")
        && (wanted_pullup != "down")
        && (wanted_pullup != "floating")
    ) {
        res
            .status( 400 )
            .send({
                msg: `Pullup value should be "up", "down", or "floating"`
            });
        return;
    }

    const pullup =
        (wanted_pullup == "up") ? Jackin.PullupMode.up :
        (wanted_pullup == "down") ? Jackin.PullupMode.down :
        (wanted_pullup == "floating") ? Jackin.PullupMode.floating :
        Jackin.PullupMode.floating; // How did we get here?

    await pin.gpio.setPullup( pullup );
    res.send({
        pullup: wanted_pullup
    });
}

import * as Tap from 'tap';
import * as Jackin from 'jackin';
import * as JackinDB from '../src/db';
import * as Mock from '../test_lib/mock';
import * as MockDevice from '../test_lib/mock_device';
import * as Superagent from 'superagent';
import { v1 as Uuid } from 'uuid';

Tap.plan( 25 );

const PORT = 3002;
const DEVICE = new MockDevice.Device();

let base_url: string;
let auth: string;


Mock.startServer({
    port: PORT
    ,device: DEVICE
})
.then( ( baseurl ) => {
    Tap.comment( "Started server" );
    base_url = baseurl;
    return Mock.setupAuth( baseurl );
})

.then( (auth_token) => {
    Tap.comment( "Sending /device request" );
    auth = auth_token;
    return Superagent
        .get( `${base_url}/device` )
        .set( 'Authorization', `Bearer ${auth}` );
})
.then( (res) => {
    Tap.ok( 200 == res.statusCode, "Correct status code" );
    Tap.ok( res.header[ 'content-type' ].match( /^application\/json/ ),
        "Got JSON in response" );
    Tap.ok( res.body[0] == "/v1/device/1",
        "Got URL to device header" );
})

.then( () => {
    Tap.comment( "Sending /device/1 request" );
    return Superagent
        .get( `${base_url}/device/1` )
        .set( 'Authorization', `Bearer ${auth}` );
})
.then( (res) => {
    Tap.ok( 200 == res.statusCode, "Correct status code" );
    Tap.ok( res.header[ 'content-type' ].match( /^application\/json/ ),
        "Got JSON in response" );

    Tap.ok( res.body[0].base_url == "/v1/device/1/1",
        "Got base URL for for pin 1" );
    Tap.ok( res.body[0].power == 5.0,
        "Pin 1 is 5V power" );

    const gpio_pin = res.body[2];
    Tap.ok( gpio_pin.base_url == "/v1/device/1/3",
        "Got base URL for pin 3" );
    Tap.ok( gpio_pin.set_mode == "/v1/device/1/3/mode",
        "Got URL for setting mode on pin 3" );
    Tap.ok( gpio_pin.value == "/v1/device/1/3/value",
        "Got URL for setting value on pin 3" );
    Tap.ok( gpio_pin.pullup == "/v1/device/1/3/pullup",
        "Got URL for setting pullup on pin 3" );
    Tap.ok( gpio_pin.cur_mode == "read",
        "Got current mode" );
    Tap.ok( gpio_pin.cur_value != null,
        "Got current value" );
    Tap.ok( gpio_pin.cur_pullup == "floating",
        "Got current pullup" );
})

.then( () => {
    Tap.comment( "Sending /device/1/3/mode request" );
    return Superagent
        .get( `${base_url}/device/1/3/mode` )
        .set( 'Authorization', `Bearer ${auth}` );
})
.then( (res) => {
    Tap.ok( 200 == res.statusCode, "Correct status code sent" );
    Tap.ok( res.header[ 'content-type' ].match( /^application\/json/ ),
        "Got JSON in response" );

    Tap.ok( res.body.mode == "read",
        "Mode is read" );
})

.then( () => {
    const pin: Jackin.GPIO = DEVICE.getPin( 3 )['gpio'];
    pin.setMode( Jackin.Mode.write );

    Tap.comment( "Changed mode, sending /device/1/3/mode request" );
    return Superagent
        .get( `${base_url}/device/1/3/mode` )
        .set( 'Authorization', `Bearer ${auth}` );
})
.then( (res) => {
    Tap.ok( 200 == res.statusCode, "Correct status code sent" );
    Tap.ok( res.body.mode == "write",
        "Mode is write" );
})

.then( () => {
    Tap.comment( "Sending /device/1/4/value request" );
    return Superagent
        .get( `${base_url}/device/1/4/value` )
        .set( 'Authorization', `Bearer ${auth}` );
})
.then( (res) => {
    Tap.ok( 200 == res.statusCode, "Correct status code sent" );
    Tap.ok( res.header[ 'content-type' ].match( /^application\/json/ ),
        "Got JSON in response" );

    Tap.ok( res.body.value == false,
        "Value is false (low)" );
})

.then( () => {
    const pin: Jackin.GPIO = DEVICE.getPin( 4 )['gpio'];
    return pin.setValue( true );
})
.then( () => {
    Tap.comment( "Sending /device/1/4/value request" );
    return Superagent
        .get( `${base_url}/device/1/4/value` )
        .set( 'Authorization', `Bearer ${auth}` );
})
.then( (res) => {
    Tap.ok( 200 == res.statusCode, "Correct status code sent" );
    Tap.ok( res.header[ 'content-type' ].match( /^application\/json/ ),
        "Got JSON in response" );

    Tap.ok( res.body.value == true,
        "Value is true (high)" );
})


.then( () => {
    return Mock.stopServer();
})
.then( () => {
    Tap.comment( "Stopped server" );
})
.catch( (err) => {
    Tap.fail( "Error: " + err );
    Mock.stopServer();
});

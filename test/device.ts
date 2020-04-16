import * as Tap from 'tap';
import * as JackinDB from '../src/db';
import * as Mock from '../test_lib/mock';
import * as Superagent from 'superagent';
import { v1 as Uuid } from 'uuid';

Tap.plan( 2 );

const PORT = 3002;

let base_url: string;


Mock.startServer({
    port: PORT
})
.then( ( baseurl ) => {
    Tap.comment( "Started server" );
    base_url = baseurl;
    return Mock.setupAuth( baseurl );
})
.then( (auth_token) => {
    Tap.comment( "Sending /device request" );
    return Superagent
        .get( `${base_url}/device` )
        .set( 'Authorization', `Bearer ${auth_token}` );
})
.then( (res) => {
    Tap.ok( 200 == res.statusCode, "Correct status code" );
    Tap.ok( res.header[ 'content-type' ].match( /^application\/json/ ),
        "Got JSON in response" );
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

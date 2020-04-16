import * as Tap from 'tap';
import * as JackinDB from '../src/db';
import Auth from '../src/db/auth';
import Castle from 'castellated';
import * as Mock from '../test_lib/mock';
import * as Superagent from 'superagent';
import { v1 as Uuid } from 'uuid';
import User from '../src/db/user';

Tap.plan( 2 );

const plain_encoder = new Castle.Plaintext();

const PORT = 3002;
const GOOD_USERNAME = 'foo';
const GOOD_PASSWORD = 'bar';
const BAD_PASSWORD = 'baz';

let base_url: string;
let auth_token: string;


Mock.startServer({
    port: PORT
})
.then( ( baseurl ) => {
    Tap.comment( "Started server" );
    base_url = baseurl;
    return Promise.all([
        User.initDB()
        ,Auth.initDB()
    ])
})
.then( (db) => {
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
})
.then( () => {
    Tap.comment( "Sending auth request" );
    return Superagent
        .post( `${base_url}/auth` )
        .auth( GOOD_USERNAME, GOOD_PASSWORD );
})
.then( (res) => {
    if( 200 != res.statusCode ) throw "Could not authenticate, bailing";
    auth_token = res.body.token;
})

.then( () => {
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

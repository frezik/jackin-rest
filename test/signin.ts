import * as Tap from 'tap';
import * as JackinDB from '../src/db';
import Auth from '../src/db/auth';
import Castle from 'castellated';
import * as Mock from './mock';
import * as Superagent from 'superagent';
import { v1 as Uuid } from 'uuid';
import User from '../src/db/user';

Tap.plan( 7 );

const plain_encoder = new Castle.Plaintext();

const PORT = 3001;
const GOOD_USERNAME = 'foo';
const GOOD_PASSWORD = 'bar';
const BAD_PASSWORD = 'baz';
const AUTH_TOKEN_SEC_TIMEOUT = 2;

let base_url: string;
let auth_token: string;


Mock.startServer({
    auth_token_sec_timeout: 2
    ,port: PORT
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
    Tap.ok( 200 == res.statusCode, "Status code is OK" );
    Tap.ok( res.header[ 'content-type' ].match( /^application\/json/ ),
        "Got JSON in response" );
    auth_token = res.body.token;
    Tap.ok( auth_token, "Got an auth token: " + auth_token );
})
.then( () => {
    Tap.comment( "Trying auth token" );
    return Superagent
        .get( `${base_url}/auth` )
        .set( 'Authorization', `Bearer ${auth_token}` );
})
.then( (res) => {
    Tap.ok( 200 == res.statusCode, "Auth token is OK" );

    return new Promise( (resolve, reject) => {
        setTimeout( () => {
            resolve();
        }, (AUTH_TOKEN_SEC_TIMEOUT + 1) * 1000 );
    });
})
.then( () => {
    Tap.comment( "Sending auth token after timeout expires" );
    return Superagent
        .get( `${base_url}/auth` )
        .ok( (res) => {
            return res.status == 401;
        })
        .set( 'Authorization', `Bearer ${auth_token}` );
})
.then( (res) => {
    Tap.ok( 401 == res.statusCode, "Auth token timeout" );
})
.then( () => {
    Tap.comment( "Sending bad auth request" );
    return Superagent
        .post( `${base_url}/auth` )
        .auth( GOOD_USERNAME, BAD_PASSWORD )
        .ok( (res) => {
            return res.status == 401;
        });
})
.then( (res) => {
    Tap.ok( 401 == res.statusCode, "Status code is OK" );
})
.then( () => {
    return Mock.stopServer();
})
.then( () => {
    Tap.comment( "Stopped server" );
})
.then( () => {
    return User.getByEmail( GOOD_USERNAME );
})
.then( (user) => {
    Tap.ok(! user.password.match( /plain/ ),
        "Password string changed to something besides plaintext" );
})
.catch( (err) => {
    Tap.fail( "Error: " + err );
    Mock.stopServer();
});

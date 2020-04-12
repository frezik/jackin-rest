import * as Tap from 'tap';
import * as JackinDB from '../src/db';
import Castle from 'castellated';
import * as Mock from './mock';
import * as Superagent from 'superagent';
import { v1 as Uuid } from 'uuid';

Tap.plan( 5 );

const plain_encoder = new Castle.Plaintext();

const GOOD_USERNAME = 'foo';
const GOOD_PASSWORD = 'bar';
const BAD_PASSWORD = 'baz';

let base_url: string;


Mock.startServer().then( ( baseurl ) => {
    Tap.comment( "Started server" );
    base_url = baseurl;
    return JackinDB.User.initDB();
})
.then( (db) => {
    return plain_encoder
        .encode( GOOD_PASSWORD )
        .then( (encoded_password) => {
            const id = Uuid();
            const user = new JackinDB.User(
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
    Tap.ok( res.body.token, "Got an auth token" );
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
    return JackinDB.User.getByEmail( GOOD_USERNAME );
})
.then( (user) => {
    Tap.ok(! user.password.match( /plain/ ),
        "Password string changed to something besides plaintext" );
})
.catch( (err) => {
    Tap.fail( "Error: " + err );
});

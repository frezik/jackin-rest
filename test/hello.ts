import * as Tap from 'tap';
import * as Mock from './mock';
import * as Superagent from 'superagent';

Tap.plan( 3 );


Mock
    .startServer()
    .then( ( baseurl ) => {
        Tap.pass( `Started server at ${baseurl}` );
        return Superagent
            .get( `${baseurl}/` );
    })
    .then( (res) => {
        Tap.ok( 200 == res.statusCode, "Status code is OK" );
    })
    .then( () => {
        return Mock.stopServer();
    })
    .then( () => {
        Tap.pass( "Stopped server" );
    })
    .catch( (err) => {
        Tap.fail( "Error: " + err );
    });

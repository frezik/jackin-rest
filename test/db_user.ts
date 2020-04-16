import * as JackinDB from '../src/db';
import * as Nano from 'nano';
import * as Tap from 'tap';
import * as Mock from '../test_lib/mock';
import User from '../src/db/user';

Tap.plan( 6 );


let user = new User(
    "foo@example.com"
    ,"plainpassword"
);
let last_rev_id: string;


Mock.setupCouchDB().then( () => {
    return User.initDB();
}).then( () => {
    return user.insert();
}).then( () => {
    Tap.ok( "foo@example.com" == user.email, "Inserted user" );
    Tap.ok( user._rev, "Rev ID set" );

    last_rev_id = user._rev;

    user.email = "bar@example.com";
    return user.update();
}).then( () => {
    Tap.ok( "bar@example.com" == user.email, "Updated user" );
    Tap.ok( last_rev_id != user._rev, "New rev set" );

    return User.getByEmail( "bar@example.com" );
}).then( (fetched_user) => {
    Tap.ok( "bar@example.com" == fetched_user.email, "Fetched user by email" );
    Tap.ok( user._rev == fetched_user._rev, "Fetched same revision" );
}).catch( (err) => {
    Tap.fail( "Error: " + err );
});

import * as Nano from 'nano';
import * as Superagent from 'superagent';

export const AUTH_DB_NAME = 'jackin-auth';


type dbNameFuncType = (
    name: string
) => string;

let DB: Nano.ServerScope;
let fetchDBName: dbNameFuncType;
let couchdbURL: URL;


let default_fetch_db_name_func: dbNameFuncType = (
    name: string
): string => {
    return name;
};

export function init(
    db: Nano.ServerScope
    ,couchdb_url: URL
    ,fetch_db_name_callback?: dbNameFuncType
): void
{
    if(! fetch_db_name_callback ) {
        fetch_db_name_callback = default_fetch_db_name_func;
    }

    fetchDBName = fetch_db_name_callback;
    couchdbURL = couchdb_url;

    DB = db;
}


export interface UserInterface extends Nano.MaybeDocument
{
    email: string
    ,password: string
}

export class User implements UserInterface
{
    _id: string;
    _rev: string;
    email: string;
    password: string;

    constructor(
        email: string
        ,password: string
        ,id?: string
        ,rev?: string
    ) {
        this.email = email;
        this.password = password;
        if( id ) this._id = id;
        if( rev ) this._rev = rev;
    }

    static initDB(): Promise<void>
    {
        return new Promise( (resolve, reject) => {
            User.makeDatabase().then( () => {
                return User.makeViews();
            }).then( () => {
                resolve();
            });
        });
    }

    static makeDatabase(): Promise<void>
    {
        const name = fetchDBName( AUTH_DB_NAME );

        return new Promise( (resolve, reject) => {
            DB.db.create( name ).then( (response) => {
                if( response.ok ) {
                    resolve();
                }
                else {
                    reject( response.reason );
                }
            });
        });
    }

    static makeViews(): Promise<void>
    {
        const name = fetchDBName( AUTH_DB_NAME );

        return new Promise( (resolve, reject) => {
            // Nano doesn't seem to have a direct way to create design 
            // documents, so call the API directly.
            let view_url = new URL( "http://localhost" );
            Object.assign( view_url, couchdbURL );
            view_url.pathname = `/${name}/_design/authByEmail`;

            Superagent
                .put( view_url.toString() )
                .send({
                    "_id": "_design/authByEmail"
                    ,views: {
                        email: {
                            map: 'function(doc) { emit( doc.email, doc.password ) }'
                        }
                    }
                    ,language: "javascript"
                })
                .end( (err, res) => {
                    if( err ) {
                        reject( err );
                    }
                    else {
                        if( 201 == res.status ) {
                            resolve();
                        }
                        else {
                            reject( "Error creating design doc authByEmail: "
                                + JSON.stringify( res.body )
                                + ", code: " + res.status );
                        }
                    }
                });
        });
    }

    static fetchDB(): Nano.DocumentScope<any>
    {
        let name = fetchDBName( AUTH_DB_NAME );
        return DB.use( name );
    }

    static getByEmail(
        email: string
    ): Promise<User>
    {
        return new Promise( (resolve, reject) => {
            const db = User.fetchDB();

            // Using callback style below because error messaging came 
            // through cleaner
            db.view( 'authByEmail', 'email', {
                key: email
                ,include_docs: true
            }, (err, result) => {
                if( err ) reject( err );
                if( result.total_rows < 1 ) {
                    reject( `No user found for email '${email}'` );
                }

                const user = new User(
                    result.rows[0].doc.email
                    ,result.rows[0].doc.password
                    ,result.rows[0].doc._id
                    ,result.rows[0].doc._rev
                );
                resolve( user );
            });
        });
    }


    insert(): Promise<void>
    {
        return new Promise( (resolve, reject) => {
            const db = User.fetchDB();
            db.insert({
                email: this.email
                ,password: this.password
            }).then( (response) => {
                if( response.ok ) {
                    this._id = response.id;
                    this._rev = response.rev;
                    resolve();
                }
                else {
                    reject( "Error inserting User: "
                        + JSON.stringify( response ) );
                }
            });
        });
    }

    update(): Promise<void>
    {
        return new Promise( (resolve, reject) => {
            const db = User.fetchDB();
            db.insert({
                email: this.email
                ,password: this.password
                ,"_rev": this._rev
                ,"_id": this._id
            }).then( (response) => {
                if( response.ok ) {
                    this._id = response.id;
                    this._rev = response.rev;
                    resolve();
                }
                else {
                    reject( "Error inserting User: "
                        + JSON.stringify( response ) );
                }
            });
        });
    }
}

import * as Nano from 'nano';
import * as DB from '../db';
import * as JackinREST from '../../index';
import * as Moment from 'moment';
import * as Superagent from 'superagent';


export const DB_NAME = 'jackin-auth-token';


export interface AuthInterface extends Nano.MaybeDocument
{
    token: string
    ,insert_time: Moment.Moment
}

export default class Auth implements AuthInterface
{
    _id: string;
    _rev: string;
    token: string;
    insert_time: Moment.Moment;

    constructor(
        token: string
        ,insert_time: Moment.Moment
        ,id?: string
        ,rev?: string
    ) {
        this.token = token;
        this.insert_time = insert_time;
        if( id ) this._id = id;
        if( rev ) this._rev = rev;
    }

    static initDB(): Promise<void>
    {
        return new Promise( (resolve, reject) => {
            Auth.makeDatabase().then( () => {
                return Auth.makeViews();
            }).then( () => {
                resolve();
            });
        });
    }

    static makeDatabase(): Promise<void>
    {
        const name = DB.fetchDBName( DB_NAME );

        return new Promise( (resolve, reject) => {
            DB.DB.db.create( name ).then( (response) => {
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
        const name = DB.fetchDBName( DB_NAME );

        return new Promise( (resolve, reject) => {
            // Nano doesn't seem to have a direct way to create design 
            // documents, so call the API directly.
            let view_url = new URL( "http://localhost" );
            Object.assign( view_url, DB.couchdbURL );
            view_url.pathname = `/${name}/_design/isTokenOK`;

            Superagent
                .put( view_url.toString() )
                .send({
                    "_id": "_design/isTokenOK"
                    ,views: {
                        token: {
                            map: 'function(doc) { emit( doc.token, doc.insert_time ) }'
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
                            reject( "Error creating design doc isTokenOK: "
                                + JSON.stringify( res.body )
                                + ", code: " + res.status );
                        }
                    }
                });
        });
    }

    static fetchDB(): Nano.DocumentScope<any>
    {
        let name = DB.fetchDBName( DB_NAME );
        return DB.DB.use( name );
    }

    static isTokenOK(
        token: string
    ): Promise<boolean>
    {
        return new Promise( (resolve, reject) => {
            const db = Auth.fetchDB();

            // Using callback style below because error messaging came 
            // through cleaner
            db.view( 'isTokenOK', 'token', {
                key: token
            }, (err, result) => {
                if( err ) {
                    reject( err );
                }
                else {
                    if( result.rows.length < 1 ) {
                        resolve( false );
                    }
                    else {
                        const insert_time_str = result.rows[0].value;
                        const insert_time = Moment( insert_time_str );
                        const expire_sec = JackinREST
                            .CONF[ 'auth_token_sec_timeout' ];
                        const expire_time = insert_time.clone().add(
                            expire_sec, 'seconds' );
                        const current_time = Moment();

                        const is_before = current_time.isBefore( expire_time );
                        resolve( is_before );
                    }
                }
            });
        });
    }


    insert(): Promise<void>
    {
        return new Promise( (resolve, reject) => {
            const db = Auth.fetchDB();
            db.insert({
                token: this.token
                ,insert_time: this.insert_time.toISOString()
            }).then( (response) => {
                if( response.ok ) {
                    this._id = response.id;
                    this._rev = response.rev;
                    resolve();
                }
                else {
                    reject( "Error inserting Auth: "
                        + JSON.stringify( response ) );
                }
            });
        });
    }

    update(): Promise<void>
    {
        return new Promise( (resolve, reject) => {
            const db = Auth.fetchDB();
            db.insert({
                token: this.token
                ,insert_time: this.insert_time.toISOString()
                ,"_rev": this._rev
                ,"_id": this._id
            }).then( (response) => {
                if( response.ok ) {
                    this._id = response.id;
                    this._rev = response.rev;
                    resolve();
                }
                else {
                    reject( "Error inserting Auth: "
                        + JSON.stringify( response ) );
                }
            });
        });
    }
}

import * as Nano from 'nano';

export const AUTH_DB_NAME = 'jackin-auth';


let DB: Nano.DatabaseScope;
export let fetchDB;


function default_fetch_db_func(
    name: string
): Nano.DocumentScope<any>
{
    return DB.use( name );
}

export function init(
    db: Nano.DatabaseScope
    ,fetch_db_callback?: (
        name: string
    ) => Nano.DocumentScope<any>
): void
{
    if(! fetch_db_callback ) fetch_db_callback = default_fetch_db_func;
    fetchDB = fetch_db_callback;

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
    ) {
        this.email = email;
        this.password = password;
        if( id ) this._id = id;
    }

    static fetch_db(): Nano.DocumentScope<any>
    {
        return fetch_db( AUTH_DB_NAME );
    }

    processAPIResponse(
        response: Nano.DocumentInsertResponse
    ) {
        if( true == response.ok ) {
            this._id = response.id;
            this._rev = response.rev;
        }
    }
}

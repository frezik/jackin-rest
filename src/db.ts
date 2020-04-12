import * as Nano from 'nano';


export type dbNameFuncType = (
    name: string
) => string;

export let DB: Nano.ServerScope;
export let fetchDBName: dbNameFuncType;
export let couchdbURL: URL;


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

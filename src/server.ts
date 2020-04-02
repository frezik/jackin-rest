function homeRoute( req, res )
{
    res.sendStatus( 200 );
}

export function makeRoutes( server ): void
{
    server.get( '/', homeRoute );
}

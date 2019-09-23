const { setHttpCallback } = require('@citizenfx/http-wrapper');
const Koa = require('koa');
const Router = require('koa-router');
const app = new Koa();
const router = new Router();
const koaBody = require('koa-body');
const serve = require('koa-static');
const render = require('koa-ejs');
let config = require('./config.js');
let sessionTokens = {}

// Reigster server events
RegisterNetEvent('jsfour-core:connected');
RegisterNetEvent('jsfour-core:addQuery');

// Debugging, mainly used to use the fetch function from a non game client
if ( config.debug ) {
    setTimeout(() => {
        StopResource('jsfour-computer');
        StartResource('jsfour-computer');
    }, 1000);
    
    sessionTokens['debug'] = 'steam:debug';
}

// Checks if the server has a higher artifact version than the one specified in the __resource.lua. Mainly used because of the globbing feature since some resources depends on it being available
function ArtifactVersion( resource ) {
    let current_version = GetConvar('version').substr(GetConvar('version').indexOf('v1') + 1, 11);
    let required_version = GetResourceMetadata( resource, 'artifact_version' );

    cv = current_version.replace(/\./g, '');
    rv = required_version.replace(/\./g, '');

    if ( cv < rv ) {
        console.error(`[${ resource }] OUTDATED SERVER ARTIFACT | CURRENT VERSION: ${ current_version }| MINIMUM REQUIRED VERSION: ${ required_version } PLEASE UPDATED YOUR SERVER!`);
    }
}

// Function to add queries to the query object. Called from other resources that uses this resource
function AddQuery( data ) {
    if ( data && typeof data === 'object' ) {
        Object.assign( config, data );
    } else {
        console.error('Tried to add a non object to the query object');
    }
}

// Function that checks if es_extended is started
function HasESX() {
    let started = true;

    if ( GetResourceState('es_extended') != 'started' ) {
        started = false;
    }

    return started;
}

ArtifactVersion(GetCurrentResourceName());

// Generates a session token, could also be used as a random string generator
function generateToken( length ) {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
}

// Add SQL queries to the list, called from other resources
onNet('jsfour-core:addQuery', ( data ) => {
    AddQuery( data );
});

// Event that gets called when a player joins the server, called from resources that needs the session token
onNet('jsfour-core:connected', () => {
    let found = false;

    if ( Object.keys( sessionTokens ).length > 0 ) {
        Object.keys( sessionTokens ).forEach(( key, i ) => {
            if ( sessionTokens[key] === GetPlayerEndpoint( source ) ) {
                found = true;
            } 
    
            if ( !found && Object.keys(sessionTokens).length === i + 1 ) {
                let t = generateToken(Math.floor(Math.random() * 10) + 8);
    
                sessionTokens[t] = GetPlayerEndpoint( source );
            
                let data = {
                    token: t,
                    endpoint: config.endpoint,
                    esx: HasESX(),
                    steam: GetPlayerIdentifier( source ),
                    debug: config.debug
                }
            
                emitNet( 'jsfour-core:session', source, data );
            } else {
                // TODO:
                // Can multiple scripts run this event?
            }
        });
    } else {
        let t = generateToken(Math.floor(Math.random() * 10) + 8);

        sessionTokens[t] = GetPlayerEndpoint( source );
    
        let data = {
            token: t,
            endpoint: config.endpoint,
            esx: HasESX(),
            steam: GetPlayerIdentifier( source ),
            debug: config.debug
        }
    
        emitNet( 'jsfour-core:session', source, data );
    }
});

// Player dropped > remove the session token
on('playerDropped', () => {
    Object.keys( sessionTokens ).forEach( ( key ) => {
        if ( sessionTokens[key] === GetPlayerEndpoint( source ) ) {
            delete sessionTokens[key];
        }
    });
});

// Execute SQL query
async function executeQuery( sql, query, params ) {
    return new Promise( ( resolve, reject ) => {
        exports['mysql-async'][sql](query, params, ( result, err ) => {
            if ( err )
                return reject( err );
           
            return resolve( result );
        });
    });
}

// Check if value exists. (Only checks if it's an insert or update query. Fetch also needs to have the @uniqueValue param)
async function valueExist( type, params ) {
    let table = config[type].query.split(' ');

    if ( table[0] === 'INSERT' ) {
        table = table[2];
    } else if ( table[0] === 'UPDATE' ) {
        table = table[1];
    }
 
    if ( Object.keys( params ).length > 0 ) {
        let result = await executeQuery( 'mysql_fetch_all', `SELECT * FROM ${ table } WHERE ${ params['@uniqueValue'].substr(1) } = "${ params[params['@uniqueValue']] }"`, {} );

        return result.length;
    } else {
        return 0;
    }
}

// Function that returns a object with all the players online and their Steam nick. If ESX is enabled it will get their first and last name instead
async function getPlayers() {
    let users = {};

    if ( HasESX() ) {
        let usersTable = await executeQuery( config['fetchNames'].sql, config['fetchNames'].query, {} );

        Object.keys(usersTable).forEach(( k ) => {
            users[usersTable[k].identifier] = `${usersTable[k].firstname} ${usersTable[k].lastname}`;
        });

        let players = GetNumPlayerIndices();
        result = {};

        for (let i = 0; i < players; i++) {
            result[GetPlayerFromIndex(i)] = users[GetPlayerIdentifier(GetPlayerFromIndex(i))];
        }
    } else {
        let players = GetNumPlayerIndices();
        result = {};

        for (let i = 0; i < players; i++) {
            result[GetPlayerFromIndex(i)] = GetPlayerName(GetPlayerFromIndex(i));
        }
    }

    return result;
}

// Data from the database
router.post('/:token/database/:type', async ( ctx ) => {
    ctx.response.append('Access-Control-Allow-Origin', '*');
    ctx.response.append('Access-Control-Allow-Methods', 'GET, POST');

    // Checks if the request has any origin, every request might not have it and it will then log unnecessary errors in the console
    if ( ctx.request.headers.origin ) {
        // Checks if it's a request from the FiveM nui. nui://game is blocked since it's from the CEF debugger 
        if ( ( ctx.request.headers.origin.includes('nui://') && !ctx.request.headers.origin.includes('nui://game') ) || config.debug ) {
            // Session token
            let token = ctx.params.token;
            // Name of the SQL object
            let type = ctx.params.type;

            // Checks if the request ip is on the server by using the session token
            if ( ctx.request.ip.split(':')[0] === sessionTokens[token] || ctx.request.ip.includes('192.168.') || sessionTokens[token] === '127.0.0.1' ) {
                // Checks if it's an insert or update query
                if ( config[type].query.includes('INSERT') || config[type].query.includes('UPDATE') ) {
                    // Checks if the request params has a @uniqueValue set
                    if ( ctx.request.body.includes('@uniqueValue') ) {
                        // If it's set it will check if the value exist before inserting it, might be useful
                        if ( !await valueExist( type, JSON.parse( ctx.request.body ) ) ) {
                            // No values found, insert/update it and return true
                            executeQuery( config[type].sql, config[type].query, JSON.parse( ctx.request.body ) );
                            ctx.body = true;
                        } else {
                            // Values found, return false
                            ctx.body = false;
                        }
                    } else {
                        // No @unqueValue, just insert/update it withouth checking and return true
                        executeQuery( config[type].sql, config[type].query, JSON.parse( ctx.request.body ) );
                        ctx.body = true;
                    }
                } else {
                    // Not an insert/update query. Probably a select or a delete query
                    let result = await executeQuery( config[type].sql, config[type].query, JSON.parse( ctx.request.body ) );

                    // Check if the result is empty 
                    if ( ~result.length ) {
                        // Return the result
                        ctx.body = result;
                    } else {
                        // Empty result, return false
                        ctx.body = false;
                    }
                }
            } else {
                // User is not on the server
                ctx.body = 'Access denied - user IP not found';
            }
        } else {
            // User  tried to access it from a non FiveM client or the CEF debugger
            ctx.body = `Access denied - Accessed from debugger or somewhere else`;
        }
    } else {
        // Request didn't have any origin, probably accessed from somewhere else
        ctx.body = `Access denied - Request had no origin`;
    }
});

// emitNet or "TriggerCLientEvent", mainly used to send data to other NUIs
router.post('/:token/emitNet/:job', async ( ctx ) => {
    ctx.response.append('Access-Control-Allow-Origin', '*');
    ctx.response.append('Access-Control-Allow-Methods', 'GET, POST');

    // Checks if the request has any origin, every request might not have it and it will then log unnecessary errors in the console
    if ( ctx.request.headers.origin ) {
        // Checks if it's a request from the FiveM nui. nui://game is blocked since it's from the CEF debugger 
        if ( ( ctx.request.headers.origin.includes('nui://') && !ctx.request.headers.origin.includes('nui://game') ) || config.debug ) {
            // Session token
            let token = ctx.params.token;
            // Name of the job
            let job = ctx.params.job;

            // Checks if the request ip is on the server by using the session token
            if ( ctx.request.ip.split(':')[0] === sessionTokens[token] || ctx.request.ip.includes('192.168.') || sessionTokens[token] === '127.0.0.1' ) {
                // Checks if you want to send data to every client or a specific job
                if ( job != 'all'  ) {
                    // To be able to send data to a speciifc job you need to have ESX installed
                    if ( HasESX() ) {
                        // Fetches all the identifiers with the specified job
                        let result = await executeQuery( config['fetchIdByJob'].sql, config['fetchIdByJob'].query, { '@job' : job } );

                        // Checks if it finds any users with that job in the database
                        if ( ~result.length ) {
                            let identifiers = {};

                            // Get all identifiers of all users who's online
                            for (let i = 1; i < GetNumPlayerIndices() + 1; i++) {
                                identifiers[GetPlayerIdentifier(i)] = i;
                            }

                            // Loop through every identifier
                            for (let i = 0; i < result.length; i++) {
                                // Check if the identifier matches an identifier from the database who has that job
                                if( identifiers.hasOwnProperty(result[i].identifier) ) {
                                    // emitNet to the specified client
                                    emitNet('jsfour-core:toNUI', identifiers[result[i].identifier], JSON.parse( ctx.request.body ));
                                }
                            } 
                        } else {
                            // Result empty, no users found with that job in the database
                            ctx.body = false;
                        }
                    } else {
                        // ESX isn't installed
                        console.error(`[jsfour-core] YOU CAN'T USE emitNet/${ job } SINCE YOU DON'T HAVE ESX INSTALLED.`);
                        ctx.body = false;
                    }
                } else {
                    // Sends data to every client on the server
                    emitNet('jsfour-core:toNUI', -1, JSON.parse( ctx.request.body ));
                    ctx.body = true;
                }
            } else {
                // User is not on the server
                ctx.body = 'Access denied - user IP not found';
            }
        } else {
            // User  tried to access it from a non FiveM client or the CEF debugger
            ctx.body = `Access denied - Accessed from debugger or somewhere else`;
        }
    } else {
        // Request didn't have any origin, probably accessed from somewhere else
        ctx.body = `Access denied - Request had no origin`;
    }
});

// emit or "TriggerServerEvent" directly from the NUI
router.post('/:token/serverevent/:event', async ( ctx ) => {
    ctx.response.append('Access-Control-Allow-Origin', '*');
    ctx.response.append('Access-Control-Allow-Methods', 'GET, POST');

    // Checks if the request has any origin, every request might not have it and it will then log unnecessary errors in the console
    if ( ctx.request.headers.origin ) {
        // Checks if it's a request from the FiveM nui. nui://game is blocked since it's from the CEF debugger 
        if ( ( ctx.request.headers.origin.includes('nui://') && !ctx.request.headers.origin.includes('nui://game') ) || config.debug ) {
            // Session token
            let token = ctx.params.token;
            // Name of the event
            let event = ctx.params.event;

            // Checks if the request ip is on the server by using the session token
            if ( ctx.request.ip.split(':')[0] === sessionTokens[token] || ctx.request.ip.includes('192.168.') || sessionTokens[token] === '127.0.0.1' ) {
                // Add your events in here
            } else {
                // User is not on the server
                ctx.body = 'Access denied - user IP not found';
            }
        } else {
            // User  tried to access it from a non FiveM client or the CEF debugger
            ctx.body = `Access denied - Accessed from debugger or somewhere else`;
        }
    } else {
        // Request didn't have any origin, probably accessed from somewhere else
        ctx.body = `Access denied - Request had no origin`;
    }
});

// Game master accessed through the browser http:/localhost:30120/jsfour-core/gamemaster?token=password
if( config.gamemaster.enabled ) {
    const gamemasterClient = generateToken(10);

    render(app, {
        root: `${GetResourcePath('jsfour-core')}/shared/views`,
        layout: 'template',
        viewExt: 'html',
        cache: false,
        debug: false,
        async: true
    });

    router.get('/gamemaster', async ( ctx ) => {
        let token = ctx.url.split('=')[1];

        if ( token === config.gamemaster.token ) {
            await ctx.render(`/gamemaster/gamemaster`, {
                title : 'gamemaster',
                token : gamemasterClient,
                endpoint : config.endpoint,
                players : await getPlayers()
            });
        } else {
            ctx.body = 'Invalid token';
        }
    });

    router.post('/:token/gamemaster', async ( ctx ) => {
        ctx.response.append('Access-Control-Allow-Origin', '*');
        ctx.response.append('Access-Control-Allow-Methods', 'POST');
        
        if ( ctx.params.token === gamemasterClient ) {  
            let data = JSON.parse( ctx.request.body );
            ctx.body = true;
            emitNet('jsfour-core:gamemaster', data.user, data.event);
        }
    });
}

app.use(koaBody({
        patchKoa: true,
        multipart: true
    }))
    .use(router.routes())
    .use(router.allowedMethods())
    .use(serve(`${GetResourcePath('jsfour-core')}/shared`));
    
setHttpCallback(app.callback());

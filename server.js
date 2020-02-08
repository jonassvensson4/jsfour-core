let config = require('./config.js');

// Reigster server events
RegisterNetEvent('jsfour-core:addQuery');
RegisterNetEvent('jsfour-core:query');
RegisterNetEvent('jsfour-core:emitNet');
RegisterNetEvent('jsfour-core:tempData');
RegisterNetEvent('jsfour-core:executeQuery');
RegisterNetEvent('jsfour-core:queryAnswer');
RegisterNetEvent('jsfour-core:esxStatus');

// Temp data, removed on server restart
let tempData = {
    storage: {},
    add: function ( data ) { // Add data to the storage object
        let program = data.data.program;
        delete data.data.program; // Remove the program since it won't be needed

        // Checks if the object already has the program
        if ( this.storage[program] ) { 
            this.storage[program][this.storage[program].length++] = JSON.stringify( data.data );
        } else {
            this.storage[program] = [];
            this.storage[program][0] = JSON.stringify( data.data );
        }
    },
    delete: function ( key, index ) {
        delete this.storage[key].splice(index, 1);
    },
    get: function ( key ) {
        return this.storage[key];
    }
}

// Client callback
function clientCallback( name, player, data, cb ) {
    (async() => {
        emitNet(name, player, data);
	
        let promise = new Promise(( resolve ) => {
            on(name, ( result ) => {
                resolve(result);
            });
        });
        
        let result = await promise;
        cb(result);
    })();
}

// Server internal query callback, called from other server resources
function internalQueryCallback( data, cb ) {
    (async() => {
        emit('jsfour-core:executeQuery', data);
        
        let promise = new Promise(( resolve ) => {
            on('jsfour-core:queryAnswer', ( result ) => {
                resolve(result);
            });
        });
        
        let result = await promise;
        setTimeout(() => {
            cb(result);
        }, 100);
    })();
}

// Checks if the server has a higher artifact version than the one specified in the __resource.lua. Mainly used because of the globbing feature since some resources depends on it being available
function ArtifactVersion( resource ) {
    let current_version = GetConvar('version').substr(GetConvar('version').indexOf('v1') + 1, 11);
    let required_version = GetResourceMetadata( resource, 'artifact_version' );
    cv = current_version.replace(/\./g, '');
    rv = required_version.replace(/\./g, '');

    if ( cv < rv ) {
        console.error(`[${ resource }] OUTDATED SERVER ARTIFACT | CURRENT VERSION: ${ current_version }| MINIMUM REQUIRED VERSION: ${ required_version } PLEASE UPDATED YOUR SERVER!`);
        emitNet('jsfour-core:error', -1, `[${ resource }] OUTDATED SERVER ARTIFACT | CURRENT VERSION: ${ current_version }| MINIMUM REQUIRED VERSION: ${ required_version } PLEASE UPDATED YOUR SERVER!`);
    }
}

ArtifactVersion(GetCurrentResourceName());

// Function to add queries to the query object. Called from other resources that uses this resource
function AddQuery( data ) {
    if ( data && typeof data === 'object' ) {
        Object.assign( config, data );
    } else {
        console.error('Tried to add a non object to the query object');
        emitNet('jsfour-core:error', -1, 'Tried to add a non object to the query object');
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

// Get the ESX status in a callback
onNet('jsfour-core:esxStatus', () => {
    emitNet('jsfour-core:esxStatus', source, HasESX());
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

// Execute SQL query from a callback or other stuff
on('jsfour-core:executeQuery', async ( data ) => {
    let result = await executeQuery( data.sql, data.query, data.params );
    emit('jsfour-core:queryAnswer', result);
});

// Check if value exists. (Only checks if it's an insert or update query. Fetch also needs to have the @uniqueValue param)
async function valueExist( type, params ) {
    let table = config[type].query.split(' ');

    if ( table[0] === 'INSERT' ) {
        table = table[2];
    } else if ( table[0] === 'UPDATE' ) {
        table = table[1];
    }
 
    if ( Object.keys( params ).length > 0 ) {
        let result = await executeQuery( 'mysql_fetch_all', `SELECT * FROM ${ table } WHERE ${ params['@uniqueValue'].substr(1) } = @unique`, { unique: params[params['@uniqueValue']] } );

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

// Add SQL queries to the list, called from other resources
onNet('jsfour-core:addQuery', ( data ) => {
    AddQuery( data );
});

// Run a SQL query
onNet('jsfour-core:query', async ( data ) => {
    // Set the source to a variable since it seems to break when using source further down?
    let _source = source;

    // Checks if it's an insert or update query
    if ( config[data.type].query.includes('INSERT') || config[data.type].query.includes('UPDATE') ) {
        // Checks if the request params has a @uniqueValue set
        if ( '@uniqueValue' in data.data ) {
            // If it's set it will check if the value exist before inserting it, might be useful
            if ( !await valueExist( data.type, data.data ) ) {
                // No values found, insert/update it and return true
                executeQuery( config[data.type].sql, config[data.type].query, data.data );
                emitNet('jsfour-core:callback', _source, true, data.CallbackID);
            }
        } else {
            // No @unqueValue, just insert/update it withouth checking and return true
            executeQuery( config[data.type].sql, config[data.type].query, data.data );
            emitNet('jsfour-core:callback', _source, true, data.CallbackID);
        }
    } else {
        // Not an insert/update query. Probably a select or a delete query
        let result = await executeQuery( config[data.type].sql, config[data.type].query, data.data );

        // Return the result
        emitNet('jsfour-core:callback', _source, result, data.CallbackID);
    }

    emitNet('jsfour-core:callback', _source, false, data.CallbackID);
});

// Send data to all clients or everyone who has a specified ESX job
onNet('jsfour-core:emitNet', async ( data ) => {
    // Checks if you want to send data to every client or a specific job
    if ( data.type != 'all'  ) {
        // To be able to send data to a speciifc job you need to have ESX installed
        if ( HasESX() ) {
            // Fetches all the identifiers with the specified job
            let result = await executeQuery( config['fetchIdByJob'].sql, config['fetchIdByJob'].query, { '@job' : data.job } );

            // Checks if it finds any users with that job in the database
            if ( result.length > 0 ) {
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
                        emitNet('jsfour-core:toNUI', identifiers[result[i].identifier], data.data);
                    }
                } 
            }
        } else {
            // ESX isn't installed
            console.error(`[jsfour-core] YOU CAN'T USE emitNet/${ job } SINCE YOU DON'T HAVE ESX INSTALLED.`);
            emitNet('jsfour-core:error', -1, `YOU CAN'T USE emitNet/${ job } SINCE YOU DON'T HAVE ESX INSTALLED.`);
        }
    } else {
        // Sends data to every client on the server
        emitNet('jsfour-core:toNUI', -1, data.data);
    }

    if ( data.tempdata ) { tempData.add(data); }
});

// Client call, modify or get tempdata
onNet('jsfour-core:tempData', ( data ) => {
    let _source = source;

    switch( data.type ) {
        case 'add':
            break;
        case 'delete':
            break;
        case 'get':
            emitNet('jsfour-core:tempData', _source, tempData.get(data.program));
            break;
    }
});

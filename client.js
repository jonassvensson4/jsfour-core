let callbacks = {};

// Register client events
RegisterNetEvent('jsfour-core:toNUI');
RegisterNetEvent('jsfour-core:error');
RegisterNetEvent('jsfour-core:esxStatus');
RegisterNetEvent('jsfour-core:callback')

onNet('jsfour-core:callback', ( result, id ) => {
    callbacks[id](result);
    delete callbacks[id];
});

// Server callback
function serverCallback( name, data, cb ) {
    let id = Object.keys( callbacks ).length++;
    callbacks[id] = cb;
    data['CallbackID'] = id;
    emitNet(name, data);
}

// Server errors - added this since some people forgets to checks their server consoles for errors..
on('jsfour-core:error', ( error ) => {
    console.error(`[jsfour-core] server error: ${ error }`);
});


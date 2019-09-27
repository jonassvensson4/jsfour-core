// Register client events
RegisterNetEvent('jsfour-core:session');
RegisterNetEvent('jsfour-core:gamemaster');
RegisterNetEvent('jsfour-core:toNUI');
RegisterNetEvent('jsfour-core:error');

// Gamemaster events
on('jsfour-core:gamemaster', ( event ) => {
    switch ( event ) {
        case 'ragdoll':
            SetPedToRagdoll(GetPlayerPed(-1), 1000, 1000, 0, 0, 0, 0);
        break;
    }
});

// Server errors - added this since some people forgets to checks their server consoles for errors
on('jsfour-core:error', ( error ) => {
    console.error(`[jsfour-core] server error: ${ error }`);
});

// Register client events
RegisterNetEvent('jsfour-core:session');
RegisterNetEvent('jsfour-core:gamemaster');
RegisterNetEvent('jsfour-core:toNUI');

// Gamemaster events
on('jsfour-core:gamemaster', ( event ) => {
    switch ( event ) {
        case 'ragdoll':
            SetPedToRagdoll(GetPlayerPed(-1), 1000, 1000, 0, 0, 0, 0);
        break;
    }
});
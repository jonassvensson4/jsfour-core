// Register client events
RegisterNetEvent('jsfour-core:toNUI');
RegisterNetEvent('jsfour-core:error');
RegisterNetEvent('jsfour-core:esxStatus');

// Server callback
function serverCallback( name, data, cb ) {
    (async() => { 
        emitNet(name, data);
	
        let promise = new Promise(( resolve ) => {
            onNet(name, ( result ) => {
                resolve(result);
            });
        });
        
        let result = await promise;
        cb(result);
    })();
}

// Server errors - added this since some people forgets to checks their server consoles for errors..
on('jsfour-core:error', ( error ) => {
    console.error(`[jsfour-core] server error: ${ error }`);
});


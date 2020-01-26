fx_version 'adamant'

game 'gta5'

ui_page 'shared/index.html'

server_script {
	'@mysql-async/lib/MySQL.lua',
	'server.js'
}

client_script 'client.js'

dependency 'mysql-async'

artifact_version '1.0.0.1222'

export 'serverCallback'

server_exports {
    'ArtifactVersion',
	'DependencyStarted',
	'AddQuery',
	'tempData',
	'clientCallback',
	'internalQueryCallback'
}

files {
	'shared/index.html',
	'shared/css/*.css',
	'shared/js/*.js',
	'shared/images/*.png',
	'shared/images/*.jpg',
	'shared/images/*.gif',
	'shared/fonts/roboto/*.woff',
	'shared/fonts/roboto/*.woff2',
	'shared/fonts/justsignature/*.woff',
	'shared/fonts/handwritten/*.woff',
}
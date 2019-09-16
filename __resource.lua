resource_manifest_version '44febabe-d386-4d18-afbe-5e627f4af937'

ui_page 'shared/index.html'

server_script {
	'@mysql-async/lib/MySQL.lua',
	'server.js'
}

client_script {
	'client.js'
}

dependencies { 
	'yarn',
	'mysql-async'
}

artifact_version '1.0.0.1222'

server_exports {
    'ArtifactVersion',
	'DependencyStarted',
	'AddQuery'
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
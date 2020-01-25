module.exports = {
    fetchNames: {
        sql: 'mysql_fetch_all',
        query: 'SELECT `identifier`, `firstname`, `lastname` FROM `users`'
    },
    login: {
        sql: 'mysql_fetch_all',
        query: 'SELECT * FROM `jsfour_users` WHERE `username` = @username AND `password` = @password'
    },
    fetchIdByJob: {
        sql: 'mysql_fetch_all',
        query: 'SELECT `identifier` FROM `users` WHERE `job` = @job'
    },
};

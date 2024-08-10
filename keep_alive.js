var http = require('http');
http.createsServer(function ( req, res) {
res.write("hello iam here");
res.send();
}).listen(8080);

var express = require('express');

var path = __dirname;

var app = express()

app.use( express.static(path) );
app.use( express.directory(path) );

app.listen( 8088, function(){ console.log("listen on 8088")});

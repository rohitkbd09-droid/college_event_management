"use strict";

var express = require('express');

var path = require('path');

var app = express();
var port = 3000; // Middleware

app.use(express["static"](path.join(__dirname))); // serves HTML/CSS files from root

app.use(express.json()); // parse JSON data

app.use(express.urlencoded({
  extended: true
})); // parse form data
// Home Route

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'home.html'));
}); // Test Route

app.get('/test', function (req, res) {
  res.send("Server is running fine!");
}); // Start Server

app.listen(port, function () {
  console.log("Server is listening on http://localhost:".concat(port));
});
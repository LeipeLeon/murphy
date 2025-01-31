#! /usr/bin/env node
/**
 * a tiny express app that lets us simulate an hls stream locally and inject errors into it
 */

var
  express = require('express'),
  path = require('path'),
  http = require('http'),
  app = express(),
  murphyPort = process.argv[2] || process.env.MURPHY_PORT || 9191,
  os = require('os'),
  fs = require('fs'),
  exphbs = require('express3-handlebars'),
  liveHls = require('./live-hls');

app.use(express.logger('dev'));

// set up handlebars
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

// all CORS all the time
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  (req.method === 'OPTIONS') ? res.send(200) : next();
});

// implement sleep timeout
app.use(function(req, res, next) {
  setTimeout(next, +req.query.sleep || 0);
});

// send back a non-200 http response code
app.use(function(req, res, next) {
  isNaN(req.query.code) ? next() : res.send(+req.query.code);
});

// set a test cookie on manifest requests to the cookie-test directory
// note that this approach only works with HLS manifests, since there are
// subsequent requests where we can verify the presence of the cookie set here
app.use(express.cookieParser());
//app.get('/test/cookie-test/master.m3u8', function (req, res, next) {
//  var age = isNaN(req.query.cookieage) ? req.query.cookieage : 10000;
//  res.cookie('xBCTest', 'valid', { maxAge: req.query.cookieage, expires: new Date(Date.now() + age), httpOnly: true });
//  next();
//});

// check for the presence of the xBCTest cookie (defined above) request header
//app.get('/test/cookie-test/content/*', function (req, res, next) {
//  req.get('Cookie') === 'xBCTest=valid' ? next() : res.send(403);
//});


//app.use('/master', express.static(__dirname + '/master'));
app.use('/master', liveHls.master);

// serve creatives statically
app.use('/creatives', express.static(__dirname + '/ads/creatives'));

// redirect to solutions for better multi-rendition testing
app.use('/ui', liveHls.ui);

app.use('/data', liveHls.dataRequest);

app.use('/error', liveHls.injectError);

app.use('/redirect', liveHls.redirectFunction);

// simulate live HLS playlists with seeking support for the entire
// event
app.use('/event', liveHls.eventFunction);

// simulate live HLS playlists with limited seeking support,
// a.k.a. "sliding window"
app.use('/live', liveHls.live);

app.use("/control", liveHls.control);

app.get('/crossdomain.xml', function(req, res) {
  fs.readFile(path.join(__dirname, 'crossdomain.xml'), function(error, data) {
    if (error) {
      return res.send(404, error);
    }

    res.set('Content-Type', 'application/xml');
    res.send(data);
  });
});

http.createServer(app).listen(murphyPort, function() {
  console.log('listening for requests at', os.hostname(), 'on port', murphyPort);
});

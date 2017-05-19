var OAuth2 = require('simple-oauth2')
var request = require('superagent')
var app = require('express')();
var fs = require('fs');
var https = require('https');
var _ = require('lodash');

require('superagent-auth-bearer')(request)

var port = 3333;
var siteurl = `https://${process.env.TESTAPP_SITE}`
var appurl = `https://localhost:${port}`

var oauth2 = OAuth2.create({
  client: {
   id: process.env.TESTAPP_CLIENT_ID,
   secret: process.env.TESTAPP_CLIENT_SECRET
  },
  auth: {
   tokenHost: `${siteurl}`,
   authorizePath: '/oauth2/auth',
   tokenPath: '/oauth2/token'
  }
});
var authorizationUri = oauth2.authorizationCode.authorizeURL({
  redirect_uri: `${appurl}/callback`,
  scope: 'core offline',
  state: Math.random().toString(36).slice(2)
});

var token = null;

try {
	token = oauth2.accessToken.create(JSON.parse(fs.readFileSync('.testapptoken', 'utf8')).token);
} catch (e) {
	console.log('Token not found on disk.');
}

var msg = `========${siteurl}========`
console.log(msg);
console.log(appurl);
console.log(msg.replace(/./g, '-'));

app.get('/callback', (req, res, next) => {
  if (req.query.err) return res.send(500, req.query.err);
	var tokenConfig = {
		code: req.query.code,
		redirect_uri: `${appurl}/callback`
	};

	oauth2.authorizationCode.getToken(tokenConfig)
	.then((result) => {
		token = oauth2.accessToken.create(result);
		fs.writeFileSync('.testapptoken', JSON.stringify(token));
		console.log('Got token.');
		res.redirect('/');
	})
	.catch(err => {next(err)});
});

app.use((req, res, next) => {
	if (token) {
		if (token.expired()) {
			token.refresh().then((result) => {
				token = result;
				fs.writeFileSync('.testapptoken', JSON.stringify(token));
				next();
			}).catch(err => {next(err)});
		} else {
			return next();
    }


	} else {
		res.redirect(authorizationUri);
	}
}, (req, res, next) => {
	request.get(`${siteurl + req.url}`).authBearer(token.token.access_token).end((err, apiRes) => {
		if (err) return next(err);
		var raw = _.escape(JSON.stringify(apiRes.body, null, ' '));
		var decorated = raw.replace(/(&quot;)((?:http|\/)(?:(?!&quot;).)+)/g, '$1<a href="$2">$2</a>');
		res.send(`<html>
<head>
<title>testapp</title>
<link rel="stylesheet" href="//cdn.jsdelivr.net/highlight.js/9.11.0/styles/default.min.css">
<script src="//cdn.jsdelivr.net/highlight.js/9.11.0/highlight.min.js"></script>
</head>
<body>
<pre><code class="json">${decorated}</code></pre>
<script>hljs.initHighlightingOnLoad();</script>`)
	});
});

// Start app 
var certificate = '-----BEGIN CERTIFICATE-----\nMIIC+zCCAeOgAwIBAgIJAM9DJqqWxiVKMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNV\nBAMMCWxvY2FsaG9zdDAeFw0xNzA1MTkwNzI4MjhaFw0yNzA1MTcwNzI4MjhaMBQx\nEjAQBgNVBAMMCWxvY2FsaG9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC\nggEBAJOalGEc2n6qT73nn/5/jzl4+cyauMshmRt7m3oFGQA0OA8aJfz8oZhAC5bT\nOW7Z0Eb6FeeVJq9O7uq78/eN4Nho05NXJAQRB6qOUbDYHJvO6qAWShzM6HedhsZs\nnA/wpPAHL2O+apDVghA8Eu4zUTWCbPiMyGq1RWjikbpzTOcMh0Ow5HaBMYYQA6yC\nd7r4Zm8bduT2hCHKTEYxZ2u02IDJuhbqRUNdOSGDadDt1pZcVgzhX6A+BGJC8XwJ\n4buR3mFdco3IAwL/FH69Jy9czuQTHCBg83zBABdr+ZuZK5KWIKsuuivJogIrLzCf\nNDfuIWYkNlReaffPwKZrDtqpO4cCAwEAAaNQME4wHQYDVR0OBBYEFGa/5u0YRcWi\nPHHZYeh8xVydkhk8MB8GA1UdIwQYMBaAFGa/5u0YRcWiPHHZYeh8xVydkhk8MAwG\nA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAGFNZg5Jqawc5Du6YgTNaTYY\n6O/ffLTu2bhJS0QDmez6TCGVGjBhEgAM5MbN/ex7HvmhZSf2qr3RdoX+HNl3iOxm\nvNuUcNXj0ANURRX6GUQXWRMHDkf6pLgfMo2nLW6By+1y+eQ+OVbclogxQ54d8D3w\nH8Oz1fcGtwCWlw7zVX6+MC7EY6/NCgmcnktrNJOeE9iEinUg5n8wAHwDWXXkB5jX\nu+VxYKmuNr+obtw+apWh7pPLk2JhK5deog6uVUtKNM2qhbQvsxa7O/9+P9hpmk0j\n7dXJqd42Py3rPZSLlNVr5DFtnkaYk/QSfHFwS59QvAlBjnbx/+/jFWGRpRmFhPo=\n-----END CERTIFICATE-----';
var privateKey = '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCTmpRhHNp+qk+9\n55/+f485ePnMmrjLIZkbe5t6BRkANDgPGiX8/KGYQAuW0zlu2dBG+hXnlSavTu7q\nu/P3jeDYaNOTVyQEEQeqjlGw2BybzuqgFkoczOh3nYbGbJwP8KTwBy9jvmqQ1YIQ\nPBLuM1E1gmz4jMhqtUVo4pG6c0znDIdDsOR2gTGGEAOsgne6+GZvG3bk9oQhykxG\nMWdrtNiAyboW6kVDXTkhg2nQ7daWXFYM4V+gPgRiQvF8CeG7kd5hXXKNyAMC/xR+\nvScvXM7kExwgYPN8wQAXa/mbmSuSliCrLroryaICKy8wnzQ37iFmJDZUXmn3z8Cm\naw7aqTuHAgMBAAECggEAUKk6yM8hv/KGXTsEvekrdbbcm6k5rxgPOWuVDVtXzDq9\nH9OkStor3K2zJ5sKWb+CCCeGbOWfHFJAUdqgefn4k4rFhFEsh2RfEh9wGPoguCyd\nHxrPKWn459UX37telX9mQx1KEnHufnOO/hw2JCG7EUjTEAivRVEGO0kFZiS4M9Ja\nakj+qnIeOnTaK1hctA+y2+STQF4zBfd+3vp5WXPwDfxw0ANnEe0EplL2Hm/fj95t\n751inCxHpHHvR39NeUwsYJRwJOHYW0WlUi8qyEdoOAHkTiXEA47qr4HbGJawOPiS\nBNNXOe+Ku+utD2rrnEF88b05i8k8o0Uy4acL6qkOoQKBgQDD3tKV1sj0+wnqhqIn\n8PpMsc8niR7vfRyO7I+2rgkcMrJJ4N1c9PBWE6ZjU3CR3usPSREdtD/+ndGncEcx\ngJ0xbWT8LYDeVQIB5K5u4AAfRUDU9kEcrSiTkX77JvPWdp108IEKszeIsHeEKr6Y\nzVn0NLUPi7Nsr/UO3pMV44gxjwKBgQDA6o4oDpvanFt0p+GKcV5HLOIRTpfz/znz\nHUOQCC/oCY12CmrPiTl5Xi57NS4GdX6lCHCHgQlySKQ2wBKnXMhnJ3WP8T2DXnH0\nBg+Zct9G9oNGjK5bCk2CvHnKs11ClX8pS8nOMszhLqjAzWhw7yrKoIrKeynK6XVZ\nMi2uPebqiQKBgG82ZkVTpdiLbU7vUMTy63t+fguJrLn4RK3WHadw25VaJ6cQ+T9d\nh9Sn5ZKB/umkM70DFKfT/333Z+H1O0cdKqO05GDXCVOz2qbujChCIW+f57bDd6br\nnp1jQEEkFdEQmkiagfpsVbzTzZiKmJu0BT5GawO/o4mzwqXFtKf6AAt7AoGAddqV\nT+lk00+0G3c4NSB/DRJhZVtTP0+LsncNQF+QDLxRPGyuxey6POgJk2Fwpad/4Ahg\n3pc5EyVHlN8QRkhLcaFMk8w33RqEmSRewUrJFowgtKfbGGkZ4yWLbgbXkYbM8YiI\nV7z3JxYfJ/IUvPGPfcxIHdzSMlEfTId4GrtcZ6kCgYB0mP1GMLIuvW2bNFk9HoFF\nguuajt2cbTV6ElrHNanC035f4CrApQiXK6iG5AUvVwGLhj6RVFuN2PZM/qM5W8Bx\nFJFVP9kzVzMyXPY5bOuBy3/XJhUu8UzvWN8v3Foj5RcH+h8WFZX//wR2pOyedVnq\ndjldZvh8eGuJpfK4wEx0rg==\n-----END PRIVATE KEY-----'; 
https.createServer({key: privateKey, cert: certificate}, app).listen(port);

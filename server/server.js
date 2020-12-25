const express = require('express')
const fetch = require('node-fetch');
const cors = require('cors')
const server = express()
const port = 8080
const api_key = '52f8f9af79e0664f928042deb0e2b888'
const bodyParser = require('body-parser')

server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));

const pg = require('pg');

const config = {
    host: 'localhost',
    // user: '',
    // password: '',
    database: 'favourites',
    port: 5432
};

const client = new pg.Client(config);
client.connect();

// client.query('SELECT NOW()', (err, res) => {
//     console.log(err, res)
//     client.end()
// })

server.use(cors())

server.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');
    res.setHeader('Accept-Charset', 'utf-8')
    next();
});

server.get('/weather/city', (req, res) => {
    let city = req.query.q;
    city = encodeURI(city);
    const url = 'https://api.openweathermap.org/data/2.5/weather?q=' + city + '&units=metric' + '&appid=' + api_key;
    fetch(url).then(function (resp) {
        if (resp.status === 200) {
            return resp.json()
        } else {
            return 404
        }
    }).then(function (data) {
        res.send(data)
    })
})

server.get('/weather/coordinates', (req, res) => {
    let lat = req.query.lat;
    let lon = req.query.lon;
    const url = 'https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon + '&units=metric' + '&appid=' + api_key
    fetch(url).then(function (resp) {
        return resp.json()
    })
        .then(function (data) {
            res.send(data)
        })
})

server.get('/favourites', (req, res) => {

    const query = 'SELECT * FROM \"city_list\"';

    client.query(query)
        .then(data => {
            let cities_data = data.rows;
            let cities = []
            for (let i = 0; i < cities_data.length; i++) {
                cities.push(cities_data[i].cityname)
            }
            res.send({cities});
        })
        .catch(err => {
            res.sendStatus(503);
        });
})

server.post('/favourites', (req, res) => {
    let cityname = req.body.name;
    let textType = typeof cityname;

    res.setHeader('Content-Type', `text/${textType}; charset=UTF-8`)

    client.query('SELECT * FROM \"city_list\" WHERE cityname=\'' + cityname + '\'')
        .then(data => {
            let cities_data = data.rows;
            if(cities_data.length === 0) {
                let query = "INSERT INTO \"city_list\" (cityname) VALUES ('"+ cityname + "')";
                client.query(query)
                    .then(() => {
                        res.sendStatus(200);
                    })
                    .catch(err => {
                        res.sendStatus(400);
                    });
            } else {
                res.sendStatus(400);
            };
        });
})

server.options('*', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS, POST');
    res.send('ok');
});

server.delete('/favourites', (req, res) => {
    let cityname = req.body.name.toLowerCase();
    let query = 'DELETE FROM \"city_list\" WHERE cityname=\'' + cityname + '\'';
    // console.log(query);

    client
        .query(query)
        .then(result => {
            res.sendStatus(200);
        })
        .catch(err => {
            res.sendStatus(400);
            throw err;
        });
});

server.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})

module.exports = server;
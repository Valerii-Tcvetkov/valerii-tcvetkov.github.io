const browserEnv = require('browser-env');
browserEnv(['navigator'])

const fetchMock = require('fetch-mock');
const JSDOM = require('jsdom').JSDOM;

const mocha = require('mocha');
const describe = mocha.describe;


const chai = require('chai');
const sinon = require('sinon');
const fetch = require('isomorphic-fetch');
const chaiHttp = require('chai-http');
const should = chai.should();
const request = require('request');
const expect = chai.expect;

chai.use(chaiHttp);

const baseURL = 'http://localhost:8080';

const pgClientStub = {
    connect: sinon.stub().returnsThis()
};

html = `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Weather</title>
    <link rel="stylesheet" href="css/main.css">
</head>

<body>
<header class="weatherTop">
    <h1 class="weatherTopName">Погода здесь</h1>
    <form method="get" name="updateLocation">
        <button class="updButton" type="button" name="updateLocation">Обновить геолокацию</button>
        <button class="updButtonImg" type="button" name="updateLocation">
            <img src="icons/reload.png" class="updateImg" alt="update"/>
        </button>
    </form>
</header>

<main class="main">
    <section class="mainCityInfo"></section>

    <section class="favorite">
        <div class="favoriteTop">
            <h2>Избранное</h2>
            <div>
                <form id="addNewCity" method="get" name="addNewCity" class="addNewCity">
                    <input required name="newCityName" class="newCity" type="text" placeholder="Добавить новый город">
                    <input type="submit" value="+" class="addButton">
                </form>
            </div>
        </div>

        <ul class="favoriteCities"></ul>
    </section>
</main>

<template id="tempCurrentCityLoader">
    <div class="currentCityLoader"></div>
</template>

<template id="tempFavoriteCityLoader">
    <li class="favoriteCity">
        <div class="currentCityLoader"></div>
    </li>
</template>

<template id="tempCurrentCity">
    <div class="mainCity">
        <h2 class="mainCityName"></h2>
        <div class="mainWeather">
            <img src="" class="currentWeatherImage" alt="weather"/>
            <p class="currentDegrees"></p>
        </div>
    </div>
    <ul class="info">
        <li class="option">
            <span>Ветер</span>
            <p></p>
        </li>
        <li class="option">
            <span>Облачность</span>
            <p></p>
        </li>
        <li class="option">
            <span>Давление</span>
            <p></p>
        </li>
        <li class="option">
            <span>Влажность</span>
            <p></p>
        </li>
        <li class="option">
            <span>Координаты</span>
            <p></p>
        </li>
    </ul>
</template>

<template id="tempFavoriteCity">
    <li class="favoriteCity">
        <div class="favoriteWeather">
            <h3 class="favoriteCityName"></h3>
            <p class="degrees"></p>
            <img src="" class="favoriteWeatherImage" alt="weather small"/>
            <button onclick="" type="button" name="button" class="deleteButton">+</button>
        </div>
        <ul class="info">
            <li class="option">
                <span>Ветер</span>
                <p></p>
            </li>
            <li class="option">
                <span>Облачность</span>
                <p></p>
            </li>
            <li class="option">
                <span>Давление</span>
                <p></p>
            </li>
            <li class="option">
                <span>Влажность</span>
                <p></p>
            </li>
            <li class="option">
                <span>Координаты</span>
                <p></p>
            </li>
        </ul>
    </li>
</template>
</body>`

window = new JSDOM(html).window;
document = window.document;
let client = require('../client/client.js');
global.window = window;
window.alert = sinon.spy();
global.document = window.document;
global.navigator = {
    userAgent: 'node.js'
};
global.fetch = fetch;
global.alert = window.alert;
global.FormData = window.FormData;

const server = require('../server/server.js');

const addCityResponse = {
    "coord": {
        "lon": 60.11,
        "lat": 55.05
    },
    "weather": [
        {
            "id":804,
            "main":"Clouds",
            "description":"overcast clouds",
            "icon":"04n"
        }
    ],
    "base":"stations",
    "main": {
        "temp":-10.36,
        "feels_like":-14.85,
        "temp_min":-10.36,
        "temp_max":-10.36,
        "pressure":1028,
        "humidity":96,
        "sea_level":1028,
        "grnd_level":984
    },
    "visibility":776,
    "wind": {
        "speed":1.96,
        "deg":41
    },
    "clouds": {
        "all":99
    },
    "dt":1608841231,
    "sys": {
        "country":"RU",
        "sunrise":1608870277,
        "sunset":1608896079
    },
    "timezone":18000,
    "id":1498894,
    "name":"Miass",
    "cod":200
};

const cityMiass = `
    <li class="favoriteCity">
        <div class="favoriteWeather">
            <h3 class="favoriteCityName">Miass</h3>
            <p class="degrees">-11°C</p>
            <img src="icons/rain.png" class="favoriteWeatherImage" alt="weather small">
            <button onclick="" type="button" name="button" class="deleteButton">+</button>
        </div>
        <ul class="info">
            <li class="option">
                <span>Ветер</span>
                <p>Light breeze, 1.96 m/s, Northeast</p>
            </li>
            <li class="option">
                <span>Облачность</span>
                <p>Cloudy</p>
            </li>
            <li class="option">
                <span>Давление</span>
                <p>1028 hpa</p>
            </li>
            <li class="option">
                <span>Влажность</span>
                <p>96 %</p>
            </li>
            <li class="option">
                <span>Координаты</span>
                <p>[55.05, 60.11]</p>
            </li>
        </ul>
    </li>
`

describe('Work with favourite city', () => {
    it('Get right html page', (done) => {
        let cityName = 'miass';
        const url = baseURL + '/weather/coordinates?q=' + cityName;
        fetchMock.get(url, addCityResponse);
        let newCity = client.newCityLoaderInfo();
        client.addCity(addCityResponse, newCity);
        const currentCity = document.getElementsByClassName('favoriteCities')[0].lastChild;
        currentCity.innerHTML.should.be.eql(cityMiass);
        done();
    });
    // it('Getting favourites', (done) => {
    //     chai.request(server)
    //         .get('/favourites')
    //         .end((err, res) => {
    //             console.log(res);
    //             expect(res).to.have.status(200);
    //             done();
    //         });
    //
    // });
});
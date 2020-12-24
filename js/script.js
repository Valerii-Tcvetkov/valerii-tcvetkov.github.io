let updateLocationForm = document.forms.namedItem('updateLocation');
let addNewCityForm = document.getElementById('addNewCity');

updateLocationForm.addEventListener('click', (event) => {
	getLocation();
	event.preventDefault();
})

addNewCityForm.addEventListener('submit', (event) => {
	addNewCity();
	event.preventDefault();
})

function request(endpoint, params) {
    const url = "http://localhost:8080/weather/";
    const request = url + endpoint + "?" + params;
	const abortController = new AbortController();
	const abortSignal = abortController.signal;
	return fetch(request, {signal: abortSignal}).then((response) => {
		if (response.ok) {
			return response.json();
		} else {
			alert('Cannot find this place');
			return 404;
		}
	}).catch(() => {
		alert('Connection was lost');
	});
}

function addSavedCities() {
	const url = "http://localhost:8080/favourites/";
	fetch(url).then((response) => {
		if (response.ok) {
			return response.json();
		}
	}).then((response) => {
        for (let i = 0; i < response.cities.length; i++) {
            const newCity = newCityLoaderInfo();
            let key = response.cities[i];
            request('city', ['q=' + key]).then((jsonResult) => {
                addCity(jsonResult, newCity);
            });
        }
    })
}

function getLocation() {
	currentCityInfoLoader();
	let currentLocation = navigator.geolocation;
	if (currentLocation) {
		currentLocation.getCurrentPosition(
			(position) => {
                fillCurrentCityInfo("city", ['q=Saint Petersburg']);
				//fillCurrentCityInfo("coordinates", [`lat=${position.coords.latitude}`, `lon=${position.coords.longitude}`]);
			},
			(error) => {
				fillCurrentCityInfo("city", ['q=Saint Petersburg']);
			}
		);
	} else {
		fillCurrentCityInfo("city", ['q=Saint Petersburg']);
	}
}

function currentCityInfoLoader() {
	const template = document.querySelector('#tempCurrentCityLoader');
	const imp = document.importNode(template.content, true);
	document.getElementsByClassName('mainCityInfo')[0].innerHTML = '';
	document.getElementsByClassName('mainCityInfo')[0].append(imp);
}

function fillCurrentCityInfo(endpoint, params) {
	request(endpoint, params).then((jsonResult) => {
		const template = document.querySelector('#tempCurrentCity');
		const imp = document.importNode(template.content, true)
		imp.querySelector('.mainCityName').innerHTML = jsonResult.name;
		imp.querySelector('.currentWeatherImage').src = `icons/${getWeatherIcon(jsonResult)}.png`;
		imp.querySelector('.currentDegrees').innerHTML = `${Math.floor(jsonResult.main.temp)}&deg;C`;
		fillWeatherInfo(jsonResult, imp);
		document.getElementsByClassName('mainCityInfo')[0].innerHTML = '';
		document.getElementsByClassName('mainCityInfo')[0].append(imp);
	});
}

function fillWeatherInfo(jsonResult, imp) {
	let p = imp.querySelectorAll('p');
	p[1].innerHTML = `${getTypeOfWind(jsonResult.wind.speed)}, ${jsonResult.wind.speed} m/s, ${getWindDirection(jsonResult.wind.deg)}`;
	p[2].innerHTML = `${getTypeOfCloudy(jsonResult.clouds.all)}`;
	p[3].innerHTML = `${jsonResult.main.pressure} hpa`;
	p[4].innerHTML = `${jsonResult.main.humidity} %`;
	p[5].innerHTML = `[${jsonResult.coord.lat}, ${jsonResult.coord.lon}]`;
}


function getTypeOfWind(wind) {
	if (wind >= 0 && wind < 6) {
		return 'Light breeze';
	} else if (wind >= 6 && wind < 15) {
		return 'Moderate breeze';
	} else if (wind >= 15 && wind < 25) {
		return 'Windy';
	} else if (wind >= 25 && wind < 33) {
		return 'Very windy';
	} else if (wind >= 33) {
		return 'Strong wind';
	}
}

function getWindDirection(deg) {
	if (deg > 11.25 && deg <= 33.75) {
		return 'North-Northeast'
	}
	if (deg > 33.75 && deg <= 56.25) {
		return 'Northeast'
	}
	if (deg > 56.25 && deg <= 78.75) {
		return 'East-Northeast'
	}
	if (deg > 78.75 && deg <= 101.25) {
		return 'East'
	}
	if (deg > 101.25 && deg <= 123.75) {
		return 'East-Southeast'
	}
	if (deg > 123.75 && deg <= 146.25) {
		return 'Southeast'
	}
	if (deg > 146.25 && deg <= 168.75) {
		return 'South-Southeast'
	}
	if (deg > 168.75 && deg <= 191.25) {
		return 'South'
	}
	if (deg > 191.25 && deg <= 213.75) {
		return 'South-Southwest'
	}
	if (deg > 213.75 && deg <= 236.25) {
		return 'Southwest'
	}
	if (deg > 236.25 && deg <= 258.75) {
		return 'West-Southwest'
	}
	if (deg > 258.75 && deg <= 281.25) {
		return 'West'
	}
	if (deg > 281.25 && deg <= 303.75) {
		return 'West-Northwest'
	}
	if (deg > 303.75 && deg <= 326.25) {
		return 'Northwest'
	}
	if (deg > 326.25 && deg <= 346.75) {
		return 'North-Northwest'
	}
	return 'North'
}

function getTypeOfCloudy(percent) {
	if (percent < 12.5) {
		return 'Clear';
	} else return 'Cloudy';
}

function addNewCity() {
	const formData = new FormData(event.target);
	const cityName = formData.get('newCityName').toString().toLowerCase();
    event.target.reset();
    // if (cityName.localeCompare('') == 0) {
    //     return;
    // }
	// if (localStorage.hasOwnProperty(cityName)) {
    //     //     alert('City is already in the list');
    // 	// 	return;
    // 	// }
	const newCity = newCityLoaderInfo();
    request('city', ['q=' + cityName]).then((response) => {
    	if (response !== 404) {
            request('city', ['q=' + cityName]).then((jsonResult) => {
                const url = "http://localhost:8080/favourites/";
                fetch(url, {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify( {
                        name: cityName
                    })
                }).then((response) => {
                    if (response.status === 200) {
                        addCity(jsonResult, newCity)
                    } else {
                        newCity.remove();
                        alert('City is already in the list');
                    }
                }).catch(() => {
                    newCity.remove();
                });
            });
		} else {
    		newCity.remove();
		}
	});
}

function newCityLoaderInfo() {
	let newCity = document.createElement('li');
	newCity.className = 'favoriteCity';
	newCity.innerHTML = '<div class="currentCityLoader"></div>';
	document.getElementsByClassName('favoriteCities')[0].appendChild(newCity);
	return newCity;
}

function addCity(jsonResult, newCity) {
	const cityName = jsonResult.name;
	newCity.id = cityName.split(' ').join('-');

	const template = document.querySelector('#tempFavoriteCity');
	const imp = document.importNode(template.content, true)
	imp.querySelector('.favoriteCityName').innerHTML = cityName;
	imp.querySelector('.degrees').innerHTML = `${Math.floor(jsonResult.main.temp)}&deg;C`;
	imp.querySelector('.favoriteWeatherImage').src = `icons/${getWeatherIcon(jsonResult)}.png`;
	imp.querySelector('.deleteButton')
		.addEventListener('click', () => deleteCity(cityName));
	fillWeatherInfo(jsonResult, imp);
	newCity.innerHTML = '';
	newCity.append(imp);
}

function deleteCity(cityName) {
    const url = "http://localhost:8080/favourites/";
	fetch(url, {
		method: 'DELETE',
        headers: {
            "Content-Type": "application/json"
        },
		body: JSON.stringify({
			name: cityName
		})
	}).then((response) => {
		if (response.status === 200){
            document.getElementById(cityName.split(' ').join('-')).remove();
		}
	})
}

function getWeatherIcon(jsonResult) {
	let clouds = haveClouds(jsonResult.clouds.all);
	let precipitation = havePrecipitation(jsonResult);

	if (clouds === 'cloudy' && precipitation === 'no') {
		return 'rain';
	} else return 'sun';
}

function haveClouds(clouds) {
	if (clouds <= 30) {
		return 'no';
	} else if (clouds <= 70) {
		return 'variable';
	}
	return 'cloudy';
}

function haveWind(wind) {
	if (wind < 14) {
		return 'no';
	} else if (wind < 33) {
		return 'windy';
	}
	return 'tempest';
}

function havePrecipitation(jsonResult) {
	let rain = 0;
	let snow = 0;
	if (jsonResult.hasOwnProperty('rain') && jsonResult.rain.hasOwnProperty('1h')) {
		rain = jsonResult.rain['1h'];
	}
	if (jsonResult.hasOwnProperty('snow') && jsonResult.snow.hasOwnProperty('1h')) {
		snow = jsonResult.snow['1h'];
	}
	if (snow > rain) {
		if (snow > 0.1) {
			return 'snow';
		}
	} else if (rain >= snow) {
		if (rain !== 0) {
			return 'rain';
		}
	}
	return 'no';
}

getLocation();
addSavedCities();
const fs = require('fs');
const simplify = require('@turf/simplify');
const sharp = require('sharp');

const feeds = JSON.parse(fs.readFileSync('./feeds.json', 'utf8')).all;

const keyGen = () => "pseudo101_" + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
})

const average = array => array.reduce((a, b) => a + b) / array.length;

const updateFeed = async (feed) => {
  if (!fs.existsSync(`./data/${feed.username}`)) {
    fs.mkdirSync(`./data/${feed.username}`);
    fs.mkdirSync(`./data/${feed.username}/icons`);
  }

  const key = keyGen();

  console.log('Updating feed', feed.fullname);

  const deviceIdReq = await fetch(`https://rutgers.passiogo.com/goServices.php?register=1&deviceId=0&token=${key}&platform=web&buildNo=undefined&oldToken=`, {
    "headers": {
      'Host': 'rutgers.passiogo.com',
      'User-Agent': 'Mozilla/ 5.0(Windows NT 10.0; Win64; x64; rv: 109.0) Gecko / 20100101 Firefox / 116.0',
      'Accept': 'application / json, text / javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'X-Requested-With': 'XMLHttpRequest',
      'Connection': 'keep-alive',
      'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at passiogosucksass@piemadd.com',
      'Referer': 'https://passiogo.com/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    },
    "method": "GET",
  });
  const { deviceId } = await deviceIdReq.json();

  const routesForm = `json=%7B%22systemSelected0%22%3A%22${feed.id}%22%2C%22amount%22%3A1%7D`;
  const stopsForm = `json=%7B%22s0%22%3A%22${feed.id}%22%2C%22sA%22%3A1%7D`;

  const routesReq = await fetch(`https://passio3.com/www/mapGetData.php?getRoutes=1&deviceId=${deviceId}&wTransloc=1`, {
    "credentials": "omit",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.5",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at passiogosucksass@piemadd.com',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site"
    },
    "referrer": "https://passiogo.com/",
    "body": routesForm,
    "method": "POST",
    "mode": "cors"
  });

  const stopsReq = await fetch(`https://passio3.com/www/mapGetData.php?getStops=2&deviceId=${deviceId}&withOutdated=1&wBounds=1&showBusInOos=0&lat=undefined&lng=undefined&wTransloc=1`, {
    "credentials": "omit",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.5",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      'Contact': 'I know I am not meant to be here. If you would like to contact me, i am available at passiogosucksass@piemadd.com',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site"
    },
    "referrer": "https://passiogo.com/",
    "body": stopsForm,
    "method": "POST",
    "mode": "cors"
  });

  const routes = await routesReq.json();
  const stops = await stopsReq.json();

  const busTemplate = fs.readFileSync('./templates/bus.svg', 'utf8');

  let iconsRef = [];

  routes.map((route) => {
    console.log(route);
    return route.color.replace('#', '')
  }).forEach((routeColor) => {
    const busIcon = busTemplate.replaceAll("#FFFFFF", `#${routeColor}`).replaceAll("#000000", '#FFFFFF');
    const busBuffer = Buffer.from(busIcon, 'utf8');
    iconsRef.push(`${routeColor}_bus.png`);

    sharp(busBuffer)
      .resize(64, 64)
      .png()
      .toFile(`./data/${feed.username}/icons/${routeColor}_bus.png`, (err, info) => {
        if (err) throw err;
        console.log(`${routeColor}_bus.png generated for ${feed.fullname}`)
      });

  });

  fs.writeFileSync(`./data/${feed.username}/icons.json`, JSON.stringify(iconsRef));

  const rawLines = Object.keys(stops.routePoints).map((routeKey) => {
    const route = routes.find((route) => route.myid === routeKey);

    if (!route) return {
      type: 'feature',
      properties: {
        routeColor: '#FFFFFF',
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [],
      }
    }

    const routeColor = route.color.replace('#', '');

    console.log(stops.routePoints[routeKey])
    const routeLines = stops.routePoints[routeKey].map((routeLine) => {
      const routePoints = routeLine.map((routePoint) => {
        if (!routePoint) return null;

        return [Number(routePoint.lng), Number(routePoint.lat)];
      });

      const filteredRoutePoints = routePoints.filter((routePoint) => routePoint !== null);

      if (filteredRoutePoints.length === 0) return null;

      const simplifiedRoutePoints = simplify({
        type: 'LineString',
        coordinates: routePoints.filter((routePoint) => routePoint !== null),
      }, {
        tolerance: 0.0001,
        highQuality: true,
      });

      console.log(simplifiedRoutePoints);

      return simplifiedRoutePoints.coordinates;
    });

    return {
      type: 'Feature',
      properties: {
        routeColor: `#${routeColor === '000000' ? 'FFFFFF' : routeColor}`,
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: routeLines.filter((routeLine) => routeLine !== null),
      },
    };
  })

  fs.writeFileSync(`./data/${feed.username}/shapes.json`, JSON.stringify({
    type: 'FeatureCollection',
    features: rawLines.filter((rawLine) => rawLine !== null),
  }));
};

const updateFeeds = async () => {
  const onlyThese = ['rutgers', 'chicago', 'gcsu', 'georgiast', 'gatech', 'sundiego', 'columbia', 'elonedu', 'emory', 'GASO', 'mit', 'newyork'];
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    if (!onlyThese.includes(feed.username)) continue;
    await updateFeed(feed);
  }
};

if (fs.existsSync('./data')) {
  fs.rmSync('./data', { recursive: true });
}

fs.mkdirSync('./data');

updateFeeds();
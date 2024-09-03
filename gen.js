const fs = require('fs');
const simplify = require('@turf/simplify');
const sharp = require('sharp');

const feeds = JSON.parse(fs.readFileSync('./feeds.json', 'utf8')).all;
const extraConfig = JSON.parse(fs.readFileSync('./extraConfig.json', 'utf8'));
const globalConfig = JSON.parse(fs.readFileSync('./globalConfig.json', 'utf8'));

const keyGen = () => "pseudo101_" + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
})

const average = array => array.reduce((a, b) => a + b) / array.length;

let shapesList = [];
let imagesList = [];
let colorsList = [];

const updateFeed = async (feed) => {
  if (!fs.existsSync(`./data/${feed.username}`)) {
    fs.mkdirSync(`./data/${feed.username}`);
    fs.mkdirSync(`./data/${feed.username}/icons`);
  }

  const key = keyGen();

  console.log('Updating feed', feed.fullname);

  /*
  const deviceIdReq = await fetch(`https://passiogo.com/goServices.php?register=1&deviceId=0&token=${key}&platform=web&buildNo=undefined&oldToken=`, {
    "headers": {
      'Host': 'rutgers.passiogo.com',
      'User-Agent': 'Mozilla/ 5.0(Windows NT 10.0; Win64; x64; rv: 109.0) Gecko / 20100101 Firefox / 116.0',
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
  */

  const deviceId = 64638265; //cheeky bastard moment

  const routesForm = `json=%7B%22systemSelected0%22%3A%22${feed.id}%22%2C%22amount%22%3A1%7D`;
  const stopsForm = `json=%7B%22s0%22%3A%22${feed.id}%22%2C%22sA%22%3A1%7D`;

  const routesReq = await fetch(`https://passiogo.com/mapGetData.php?getRoutes=1&deviceId=${deviceId}&wTransloc=1`, {
    "credentials": "omit",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.5",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site"
    },
    "referrer": "https://passiogo.com/",
    "body": routesForm,
    "method": "POST",
    "mode": "cors"
  });

  const stopsReq = await fetch(`https://passiogo.com/mapGetData.php?getStops=2&deviceId=${deviceId}&withOutdated=1&wBounds=1&showBusInOos=0&lat=undefined&lng=undefined&wTransloc=1`, {
    "credentials": "omit",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.5",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
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

  if (routes.error || stops.error) return; //this agency is invalid

  //fs.writeFileSync('./routes.json', JSON.stringify(routes));
  //fs.writeFileSync('./stops.json', JSON.stringify(stops));

  const busTemplate = fs.readFileSync('./templates/bus.svg', 'utf8');
  const circleTemplate = fs.readFileSync('./templates/circle.svg', 'utf8');
  const arrowTemplate = fs.readFileSync('./templates/arrow.svg', 'utf8');

  let iconsRef = [];

  routes.map((route) => {
    return [route.color.replace('#', ''), route.myid]
  }).forEach((routeColor) => {
    let actualColor = routeColor[0].toString().toUpperCase();

    if (globalConfig.colorReplacements[actualColor]) actualColor = globalConfig.colorReplacements[actualColor];

    //console.log(actualColor, routeColor[1])

    const busIcon = busTemplate.replaceAll("FILL", `#${actualColor}`).replaceAll("BORDERS", feed.black && feed.black.includes(routeColor[1]) ? '#000000' : '#FFFFFF');
    const busBuffer = Buffer.from(busIcon, 'utf8');
    iconsRef.push(`${actualColor.toUpperCase()}_bus.png`);

    const arrowIcon = arrowTemplate.replaceAll("FILL", `#${actualColor}`).replaceAll("BORDERS", feed.black && feed.black.includes(routeColor[1]) ? '#000000' : '#FFFFFF');
    const arrowBuffer = Buffer.from(arrowIcon, 'utf8');
    iconsRef.push(`${actualColor.toUpperCase()}_arrow.png`);

    const circleIcon = circleTemplate.replaceAll("FILL", `#${actualColor}`).replaceAll("BORDERS", feed.black && feed.black.includes(routeColor[1]) ? '#000000' : '#FFFFFF');
    const circleBuffer = Buffer.from(circleIcon, 'utf8');
    iconsRef.push(`${actualColor.toUpperCase()}_circle.png`);

    /*
    sharp(busBuffer)
      .resize(64, 64)
      .png()
      .toFile(`./data/${feed.username}/icons/${actualColor.toUpperCase()}_bus.png`, (err, info) => {
        if (err) throw err;
        //console.log(`${routeColor[0]}_bus.png generated for ${feed.fullname}`)
      });
      */

    sharp(arrowBuffer)
      .resize(120, 120)
      .png()
      .toFile(`./data/${feed.username}/icons/${actualColor.toUpperCase()}_arrow.png`, (err, info) => {
        if (err) throw err;
        //console.log(`${routeColor[0]}_bus.png generated for ${feed.fullname}`)
      });
      
      sharp(circleBuffer)
      .resize(64, 64)
      .png()
      .toFile(`./data/${feed.username}/icons/${actualColor.toUpperCase()}_circle.png`, (err, info) => {
        if (err) throw err;
        //console.log(`${routeColor[0]}_bus.png generated for ${feed.fullname}`)
      });

    colorsList.push(`${actualColor}_${feed.black && feed.black.includes(routeColor[1]) ? '000000' : 'FFFFFF'}`);
  });

  fs.writeFileSync(`./data/${feed.username}/icons.json`, JSON.stringify(iconsRef));
  imagesList.push(...iconsRef.map((n) => {
    return `${feed.username}/icons/${n}`
  }));

  const rawLines = Object.keys(stops.routePoints).map((routeKey) => {
    const route = routes.find((route) => route.myid === routeKey);

    if (!route) return {
      type: 'feature',
      properties: {
        routeColor: '#FFFFFF',
        routeType: '3',
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [],
      }
    }

    let routeColor = route.color.replace('#', '');
    if (globalConfig.colorReplacements[routeColor]) routeColor = globalConfig.colorReplacements[routeColor];

    //console.log(stops.routePoints[routeKey])
    const routeLines = stops.routePoints[routeKey].map((routeLine) => {
      const routePoints = routeLine.map((routePoint) => {
        if (!routePoint) return null;

        return [Number(routePoint.lng), Number(routePoint.lat)];
      });

      const filteredRoutePoints = routePoints.filter((routePoint) => routePoint !== null);

      if (filteredRoutePoints.length < 2) return null;

      /*
      const simplifiedRoutePoints = simplify({
        type: 'LineString',
        coordinates: filteredRoutePoints.filter((routePoint) => routePoint !== null),
      }, {
        tolerance: 0.00001,
        highQuality: true,
      });
      */

      return filteredRoutePoints.filter((routePoint) => routePoint !== null);

      //console.log(simplifiedRoutePoints);

      return simplifiedRoutePoints.coordinates;
    });

    return {
      type: 'Feature',
      properties: {
        routeID: feed.combineBasedOnName ? (route.shortName.length > 0 ? route.shortName : route.nameOrig) : route.myid,
        routeShortName: route.shortName ?? '',
        routeLongName: route.nameOrig,
        routeColor: `#${routeColor === '000000' ? 'FFFFFF' : (routeColor === 'FFFFFF' ? '000000' : routeColor)}`,
        minZoom: 8,
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
  shapesList.push(`${feed.username}/shapes.json`);
};

const updateFeeds = async () => {
  const onlyThese = ['rutgers', 'chicago', 'gcsu', 'georgiast', 'gatech', 'GASO', 'mit', 'newyork', 'uncc', 'uncg', 'uncw', 'bamabama', 'ncstateuni'];
  for (let i = 0; i < feeds.length; i++) {
    let feed = feeds[i];

    if (extraConfig[feed.username]) {
      feed = {
        ...feed,
        ...extraConfig[feed.username],
      };
    }

    //if (!onlyThese.includes(feed.username)) continue;
    //if (feed.username !== 'unm') continue;
    await updateFeed(feed);
  }
  fs.writeFileSync('./allIcons.json', JSON.stringify(imagesList));
  fs.writeFileSync('./allShapes.json', JSON.stringify(shapesList));
  fs.writeFileSync('./colorsList.json', JSON.stringify([...new Set(colorsList.sort())]));
};

if (fs.existsSync('./data')) {
  fs.rmSync('./data', { recursive: true });
}

fs.mkdirSync('./data');

updateFeeds();
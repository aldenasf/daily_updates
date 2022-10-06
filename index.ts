// import * as dotenv from 'dotenv'; 
import { Client } from '@notionhq/client';
import fetch from 'node-fetch'
import express from 'express';
// dotenv.config();

let lastRun:Date, lastCheck:Date; 
const port = 80;
const db_id = process.env.NOTION_DB_ID;

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const app = express()

app.get('/', async (req, res) => {
    res.redirect('/check');
})

app.get('/check', async (req, res) => {
    console.log(`[PING] [${new Date()}] Running check...`)
    let result = await checkDate();
    res.send({
        "status": 200,
        "database_upate": result,
        "last_check" : lastCheck.toLocaleString('en-us'),
        "last_update": lastRun.toLocaleString('en-us')
    })
    .status(200)
    
    if (result) console.log(`[PING] Database update returned true`)
    else        console.log(`[PING] Database update returned false`);
})

app.get('/force_new', async (req, res) => {
    if (req.query && 'key' in req.query && req.query['key'] === process.env.FORCE_NEW_KEY) {
        let date:Date = new Date();
        lastRun = date;
        main()
        return res.send({
            "status": 200,
            "message": "Updated database."
        }).status(200)
    } else {
        return res.send({
            "status": 401,
            "error": "Unauthorized",
            "key" : (req.query ? req.query['key'] ? req.query['key'] : 'undefined' : 'undefined')
        })
        .status(401)
    }
});

app.listen(port, () => {
    console.log(`[EXPRESS] [${new Date()}] Listening at port ${port}`)
})

const Entry = {
    airQualityIndex: {
        'good'                  : 'Good',
        'moderate'              : 'Moderate',
        'unhealthySensitive'    : 'Unhealthy for sensitive groups',
        'unhealthy'             : 'Unhealthy',
        'veryUnhealthy'         : 'Very Unhealthy',
        'hazardous'             : 'Hazardous'
    },

    uvIndex: {
        'low'       : 'Low',
        'moderate'  : 'Moderate',
        'high'      : 'High',
        'veryHigh'  : 'Very High',
        'extreme'   : 'Extreme'
    },

    severityPhrase : {
        '0'     : "0. Unknown",
        '1'     : "7. Significant",
        '2'     : "6. Major",
        '3'     : "5. Moderate",
        '4'     : "4. Minor",
        '5'     : "3. Minimal",
        '6'     : "2. Insignificant",
        '7'     : "1. Informational"
    },

    tempUnits: [
        {
            'fahrenheit': 'F',
            'celsius'   : 'C'
        },
        {
            'fahrenheit': 'F',
            'celsius'   : 'C'
        }
    ],

    precipitation: {
        'true'  : 'True 🌧️',
        'false' : 'False ⛅'
    },

    precipitationType: {
        'none'          : 'None',
        'rain'          : 'Rain🌧️',
        'snow'          : 'Snow 🌨️',
        'ice'           : 'Ice ❄️',
        'mixed'         : 'Mixed❓'
    },

    precipitationIntensity: {
        'none'      : 'None',
        'light'       : 'Low',
        'moderate'  : 'Moderate',
        'heavy'      : 'High'
    },

    moonPhase: {
        'Unknown'           : "0. Unknown",
        'New'               : "1. 🌑 New moon",
        'WaxingCrescent'    : "2. 🌒 Waxing Crescent Moon",
        'FirstQuarter'      : "3. 🌓 First Quarter Moon",
        'WaxingGibbous'     : "4. 🌔 Waxing Gibbous Moon",
        'Full'              : "5. 🌕 Full Moon",
        'WaningGibbous'     : "6. 🌖 Waning Gibbous Moon",
        'LastQuarter'       : "7. 🌗 Last Quarter Moon",
        'WaningCrescent'    : "8. 🌘 Waning Crescent Moon."
    }
};

main();

async function checkDate() {
    const date = new Date();
    lastCheck = date;
    if (date.getUTCDate() !== lastRun.getUTCDate() || date.getUTCMonth() !== lastRun.getUTCMonth() || date.getUTCFullYear() !== lastRun.getUTCFullYear()) {
        await main();
        lastRun = date;
        return true;        
    } else {
        return false;
    }
}

async function main () {
    lastRun = new Date()

    const weather = await fetchWeather() || {
        date: undefined,
        airQualityIndex: undefined,
        uvIndex: undefined,
        severity: undefined,
        temps: [undefined, undefined],
        tempUnits: [undefined, undefined],
        wind: undefined,
        hasPrecipitation: false,
        precipitationType: undefined,
        precipitationIntensity: undefined,
        precipitationProbability: undefined,
        thunderstormProbability: undefined,
        rainProbability: undefined,
        snowProbability: undefined,
        iceProbability: undefined,
        hoursOfPrecipitation: undefined,
        cloudCover: undefined,
        solarIrradiance: undefined,
        sunRise: undefined,
        sunSet: undefined,
        moonRise: undefined,
        moonSet: undefined,
        moonPhase: undefined,
    };

    // TODO: Create new entry in database (using id: process.env.NOTION_DB_ID).
    // NOTE: When a new page has an empty property on it, it will NOT out put an error but instead leave the value empty.


    await notion.pages.create({
        parent: { 
            'type': 'database_id', 
            'database_id': db_id
        },

        icon: {
            type: 'emoji',
            emoji: '🌦️'
        },

        properties: {
            "Phrase": {
                'type': 'title',
                'title': [{ 'type': 'text', 'text': { 'content': (new Date().toLocaleString('en-us')) } }]
            },

            "Date": {
                'type': 'date',
                'date': { 'start': (new Date().toISOString()) } /*.slice(0, 19) + 'Z'*/
            },

            "Air Quality Index": {
                'type': 'select',
                'select': { 'name': 'Good' }
            },

            "UV Index": {
                'type': 'select',
                'select': { 'name': 'High' }
            },

            "Severity": {
                'type': 'number',
                'number': (Number(8 - Number(weather ? weather.severity : 0)))
            },

            "Severity Phrase": {
                'type': 'select',
                'select': { 'name': (weather ? weather.severity ? validateSeverityPhrase(Number(weather.severity)) : Entry.severityPhrase[0] : Entry.severityPhrase[0]) }
            },

            // For temperature:
            // weather.temps = [min, max]
            // weather.tempUnits = [minUnit, maxUnit] (possible unit values: 'C' for celsius, 'F' for fahrenheit, 'K' for kelvin? kelvin not tested)

            "Min temp": {
                'type': 'number',
                'number': Number(convertToCelsiusIfNotCelsius(Number(weather ? weather.temps[0] : 0), weather?.tempUnits[0] ? weather.tempUnits[0] : 'F'))
            },

            "Max temp": {
                'type': 'number',
                'number': Number(convertToCelsiusIfNotCelsius(Number(weather ? weather.temps[1] : 0), weather?.tempUnits[1] ? weather.tempUnits[1] : 'F'))
            },

            "Temperature Units" : {
                'type': 'rich_text',
                'rich_text': [{ 'type':'text', 'text': { 'content': `Min: ${weather ? weather.tempUnits ? weather.tempUnits[0] : 'Unable to fetch temperature unit' : 'Unable to fetch weather'}. Max: ${weather ? weather.tempUnits ? weather.tempUnits[0] : 'Unable to fetch temperature unit' : 'Unable to fetch weather'}. Converted to: C` } }] },

            "Wind": {
                'type': 'rich_text',
                'rich_text': [{ 'type': 'text', 'text': { 'content': (String(weather ? weather.wind : "Unable to get wind information.")) } }]
            },

            "Precipitation": {
                'type': 'select',
                'select': { 'name': Entry.precipitation['true'] }
            },

            "Precipitation Type": {
                'type': 'select',
                'select': { 'name': String(Entry.precipitationType[weather?.precipitationType ? (weather.precipitationType.toLowerCase() === 'rain' ? 'rain' : weather.precipitationType.toLowerCase() === 'snow' ? 'snow' : weather.precipitationType.toLowerCase() === 'ice' ? 'ice' : weather.precipitationType.toLowerCase() === 'mixed' ? 'mixed' : 'none') : 'none']) }
            },

            "Precipitation Intensity": {
                'type': 'select',
                'select': { 'name': String(Entry.precipitationIntensity[weather?.precipitationIntensity ? (weather.precipitationIntensity.toLowerCase() === 'none' ? 'none' : weather.precipitationIntensity.toLowerCase() === 'light' ? 'light' : weather.precipitationIntensity.toLowerCase() === 'moderate' ? 'moderate' : weather.precipitationType === 'heavy' ? 'heavy' : 'none') : 'none']) }
            },

            "Precipitation Probability": {
                'type': 'number',
                'number': (Number(weather ? weather.precipitationProbability ? weather.precipitationProbability / 100 : 0 : 0))
            },

            "Thunderstorm Probability": {
                'type': 'number',
                'number': (Number(weather ? weather.thunderstormProbability ? weather.thunderstormProbability / 100 : 0 : 0))
            },

            "Rain Probability": {
                'type': 'number',
                'number': (Number(weather ? weather.rainProbability ? weather.rainProbability / 100 : 0 : 0))
            },

            "Snow Probability": {
                'type': 'number',
                'number': (Number(weather ? weather.snowProbability ? weather.snowProbability / 100 : 0 : 0))
            },

            "Ice Probability": {
                'type': 'number',
                'number': (Number(weather ? weather.iceProbability ? weather.iceProbability / 100 : 0 : 0))
            },

            "Hours of precipitation": {
                'type': 'number',
                'number': (Number(weather ? weather.hoursOfPrecipitation ? weather.hoursOfPrecipitation : 0 : 0))
            },

            "Cloud Cover": {
                'type': 'number',
                'number': (Number(weather ? weather.cloudCover ? weather.cloudCover / 100 : 0 : 0))
            },

            "Solar Irradiance": {
                'type': 'rich_text',
                'rich_text': [{ 'type': 'text', 'text': {'content': String(weather ? weather.solarIrradiance ? weather.solarIrradiance + ' W/m²' : "Unable to fetch solar irradiance" : "Unable to fetch weather")} }]
            },

            "Sun Rise": {
                'type': 'date',
                'date': { 'start': (weather ? weather.sunRise ? String(weather.sunRise).slice(0, 19) + 'Z' : new Date().toISOString() : new Date().toISOString()) }
            },

            "Sun Set": {
                'type': 'date',
                'date': { 'start': (weather ? weather.sunSet ? String(weather.sunSet).slice(0, 19) + 'Z' : new Date().toISOString() : new Date().toISOString()) }
            },

            "Moon Rise": {
                'type': 'date',
                'date': { 'start': (weather ? weather.moonRise ? String(weather.moonRise).slice(0, 19) + 'Z' : new Date().toISOString() : new Date().toISOString()) }
            },

            "Moon Set": {
                'type': 'date',
                'date': { 'start': (weather ? weather.moonSet ? String(weather.moonSet).slice(0, 19) + 'Z' : new Date().toISOString() : new Date().toISOString()) }
            },
        }
    })
    .then(() => {
        console.log(`[Notion] [${new Date().toLocaleString('en-us')}] Pushed new page/entry to database.`)
    })
}

function validateSeverityPhrase(severity:Number) {
    switch (severity) {
        case 0: return Entry.severityPhrase[0]
        break;
        case 1: return Entry.severityPhrase[1]
        break;
        case 2: return Entry.severityPhrase[2]
        break;
        case 3: return Entry.severityPhrase[3]
        break;
        case 4: return Entry.severityPhrase[4]
        break;
        case 5: return Entry.severityPhrase[5]
        break;
        case 6: return Entry.severityPhrase[6]
        break;
        case 7: return Entry.severityPhrase[7]
        break;
    };

    return Entry.severityPhrase[0];
}

function convertToCelsiusIfNotCelsius(temperature:number, unit:('C'|'F'|'K')) {

    // TODO: Check if ${unit} is 'F'
    //      If unit is 'C', return ${temperature}                                           // returns same ${temperature} value
    // Else if unit is 'F', return Number(Number(${temperature} - 32) * (5/9)).toFixed(2)   // toFixed(N) returns number in N decimal places
    // Else if unit is 'K', return Number(Number(${temperature} - 273.15).toFixed(2))       // toFixed(N) returns number in N decimal places

    if (unit === 'C') {         // Celsius
        return temperature;
    } else if (unit === 'F') {  // Fahrenheit
        return Number(Number((temperature - 32) * (5/9)).toFixed(2));
    } else if (unit === 'K')  { // Kelvin
        return Number(Number(temperature - 273.15).toFixed(2));
    } else {                    // Unknown(returns same ${temperature} value)
        return temperature;
    }
}

function convertMilesToKilometer(distance:number) {
    return Number(Number(distance * 1.609).toFixed(2));
}

async function fetchWeather():Promise<Weather|undefined> {
    let data:Weather|undefined = undefined; 

    const url = `http://dataservice.accuweather.com/forecasts/v1/daily/1day/${process.env.ACCUWEATHER_CITY_ID}?apikey=${process.env.ACCUWEATHER_API_KEY}&language=en-us&details=true&metric=false`;
    
    // TODO: Fetches weather using accuweather.com
    //
    // http://dataservice.accuweather.com/forecasts/v1/daily/1day
    // / process.env.ACCUWEATHER_CITY_ID
    // ? apikey: process.env.ACCUWEATHER_API_KEY
    // & language: en-us
    // & details: true
    // & metric: false
    
    await fetch(url)
    .then((res) => res.json())
    .then((res:any) => {
        // console.log(util.inspect(res, {showHidden: false, depth: null, colors: true}));
        if (res) {
            data = { // Format response and push to ${data}s
                date                        : res.DailyForecasts[0].Date,
                airQualityIndex             : res.DailyForecasts[0].AirAndPollen.find((obj:any) => obj['Name'] === 'AirQuality').Category,
                uvIndex                     : res.DailyForecasts[0].AirAndPollen.find((obj:any) => obj['Name'] === 'UVIndex').Category,
                severity                    : res.Headline.Severity,
                temps                       : [res.DailyForecasts[0].Temperature.Minimum.Value, res.DailyForecasts[0].Temperature.Maximum.Value], // [min, max]
                tempUnits                   : [res.DailyForecasts[0].Temperature.Minimum.Unit, res.DailyForecasts[0].Temperature.Maximum.Unit], // [min, max]
                wind                        : `Heading ${res.DailyForecasts[0].Day.Wind.Direction.Degrees} (${res.DailyForecasts[0].Day.Wind.Direction.Localized}) at ${convertMilesToKilometer(Number(res.DailyForecasts[0].Day.Wind.Speed.Value))} km/h (${res.DailyForecasts[0].Day.Wind.Speed.Value} ${res.DailyForecasts[0].Day.Wind.Speed.Unit})`,
                hasPrecipitation            : res.DailyForecasts[0].Day.HasPrecipitation,
                precipitationType           : res.DailyForecasts[0].Day.PrecipitationType||undefined,
                precipitationIntensity      : res.DailyForecasts[0].Day.PrecipitationIntensity||undefined,
                precipitationProbability    : res.DailyForecasts[0].Day.PrecipitationProbability,
                thunderstormProbability     : res.DailyForecasts[0].Day.ThunderstormProbability,
                rainProbability             : res.DailyForecasts[0].Day.RainProbability,
                snowProbability             : res.DailyForecasts[0].Day.SnowProbability,
                iceProbability              : res.DailyForecasts[0].Day.IceProbability,
                hoursOfPrecipitation        : res.DailyForecasts[0].Day.HoursOfPrecipitation,
                cloudCover                  : res.DailyForecasts[0].Day.CloudCover,
                solarIrradiance             : res.DailyForecasts[0].Day.SolarIrradiance.Value,
                sunRise                     : res.DailyForecasts[0].Sun.Rise,
                sunSet                      : res.DailyForecasts[0].Sun.Set,
                moonRise                    : res.DailyForecasts[0].Moon.Rise,
                moonSet                     : res.DailyForecasts[0].Moon.Set,
                moonPhase                   : res.DailyForecasts[0].Moon.Phase
            };
            return data;
        } else {
            return undefined;
        }
    })
    .catch((err) => console.log(err));

    return data;
}

type Weather = {
    date                        : string|undefined;
    airQualityIndex             : string|undefined;
    uvIndex                     : string|undefined;
    severity                    : string|undefined;
    temps                       : Array<string|undefined>;
    tempUnits                   : Array<'C'|'F'|undefined>;
    wind                        : string|undefined;
    hasPrecipitation            : boolean|undefined;
    precipitationType           : string|undefined;
    precipitationIntensity      : string|undefined;
    precipitationProbability    : number|undefined;
    thunderstormProbability     : number|undefined;
    rainProbability             : number|undefined;
    snowProbability             : number|undefined;
    iceProbability              : number|undefined;
    hoursOfPrecipitation        : number|undefined;
    cloudCover                  : number|undefined;
    solarIrradiance             : number|undefined;
    sunRise                     : string|undefined;
    sunSet                      : string|undefined;
    moonRise                    : string|undefined;
    moonSet                     : string|undefined;
    moonPhase                   : string|undefined;
}
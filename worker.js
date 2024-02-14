const Config = {
    repository: 'celetor/epg',
    branch: 'master'
}

const init = {
    status: 200,
    headers: {
        'content-type': 'application/json'
    },
};

function makeRes(body, status = 200, headers = {}) {
    headers['access-control-allow-origin'] = '*';
    return new Response(body, {status, headers});
}

function getNowDate() {
    const utc_timestamp = (new Date()).getTime();
    const china_time = new Date(utc_timestamp + 8 * 60 * 60 * 1000);
    const month = china_time.getMonth() + 1;
    const day = china_time.getDate();
    return `${china_time.getFullYear()}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
}

function getFormatTime(time) {
    // 20231129002400 +0800
    let result = {
        date: '',
        time: ''
    };

    if (time.length < 8) {
        result['date'] = getNowDate();
        return result;
    }

    let year = time.substring(0, 4);
    let month = time.substring(4, 6);
    let day = time.substring(6, 8);
    result['date'] = year + '-' + month + '-' + day;

    if (time.length >= 12) {
        let hour = time.substring(8, 10);
        let minute = time.substring(10, 12);
        result['time'] = hour + ':' + minute;
    }
    return result;
}

async function diypHandle(channel, date, request) {
    const res = await fetch(new Request(`https://raw.githubusercontent.com/${Config.repository}/${Config.branch}/json/e_${date}.json`, request));
    const response = await res.json();

    console.log(channel, date);
    const program_info = {
        "date": date,
        "channel_name": channel,
        "url": `https://github.com/${Config.repository}`,
        "epg_data": []
    }
    response.forEach(function (element) {
        if (element['@channel'] === channel && element['@start'].startsWith(date.replaceAll('-', ''))) {
            program_info['epg_data'].push({
                "start": getFormatTime(element['@start'])['time'],
                "end": getFormatTime(element['@stop'])['time'],
                "title": element['title']['#text'],
                "desc": (element['desc'] && element['desc']['#text']) ? element['desc']['#text'] : ''
            });
        }

    });
    console.log(program_info);
    if (program_info['epg_data'].length === 0) {
        program_info['epg_data'].push({
            "start": "00:00",
            "end": "23:59",
            "title": "未知节目",
            "desc": ""
        });
    }
    return new Response(JSON.stringify(program_info), init);
}

async function fetchHandler(event) {
    let request = event.request;
    let uri = new URL(request.url);

    let channel = uri.searchParams.get("ch");
    if (!channel || channel.length === 0) {
        const xml_res = await fetch(new Request(
            `https://raw.githubusercontent.com/${Config.repository}/${Config.branch}/xml/e.xml`, request
        ));
        const xml_blob = await xml_res.blob();
        init['headers']['content-type'] = 'text/xml';
        return new Response(xml_blob, init);
    }

    let date = uri.searchParams.get("date");
    if (date) {
        date = getFormatTime(date.replace(/\D+/g, ''))['date'];
    } else {
        date = getNowDate();
    }

    channel = channel.replaceAll('-', '').toUpperCase();

    if (parseInt(date.replaceAll('-', '')) >= 20231122) {
        return diypHandle(channel, date, request);
    } else {
        return new Response(JSON.stringify({
            "date": date,
            "channel_name": channel,
            "url": `https://github.com/${Config.repository}`,
            "epg_data": [{
                "start": "00:00",
                "end": "23:59",
                "title": "未知节目",
                "desc": ""
            }]
        }), init);
    }
}

addEventListener('fetch', event => {
    const ret = fetchHandler(event).catch(err => makeRes('cfworker error:\n' + err.stack, 502));
    event.respondWith(ret)
})

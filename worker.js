// main.ts
const Config = {
    repository: 'celetor/epg',
    branch: '112114'
};

const init = {
    status: 200,
    headers: {
        'content-type': 'application/json'
    },
};

async function jq_fetch(request, cacheKey) {
    const cache = await caches.open('epg-cache');
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
        return cachedResponse; // 返回缓存
    }

    let times = 5;
    let real_url = '';
    let isRedirect = false;
    let response = await fetch(request);

    while (times > 0) {
        if (response.status === 301 || response.status === 302) {
            isRedirect = true;
            real_url = response.headers.get('location');
        } else if (response.redirected === true) {
            isRedirect = true;
            real_url = response.url;
        } else {
            break;
        }
        if (isRedirect) {
            let init = { headers: {} };
            for (var p of response.headers) {
                if (p[0].toLowerCase() !== 'location') {
                    if (p[0].toLowerCase() === 'set-cookie') {
                        init.headers['cookie'] = p[1];
                    } else {
                        init.headers[p[0]] = p[1];
                    }
                }
            }
            response = await fetch(new Request(real_url, init));
            times -= 1;
        }
    }

    if (response.ok) {
        await cache.put(cacheKey, response.clone()); // 使用自定义缓存键
    }
    return response;
}

function makeRes(body, status = 200, headers = {}) {
    headers['access-control-allow-origin'] = '*';
    return new Response(body, { status, headers });
}

function getNowDate() {
    const utc_timestamp = (new Date()).getTime();
    const china_time = new Date(utc_timestamp + 8 * 60 * 60 * 1000);
    const month = china_time.getMonth() + 1;
    const day = china_time.getDate();
    return `${china_time.getFullYear()}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
}

function getFormatTime(time) {
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
    const tag = date.replaceAll('-', '.');
    const targetUrl = `https://github.com/${Config.repository}/releases/download/${tag}/${Config.branch}.json`;
    const cacheKey = `${targetUrl}?ch=${channel}`; // 缓存键包含 channel 和 date（通过 tag）
    const res = await jq_fetch(new Request(targetUrl, request), cacheKey);
    const response = await res.json();

    const program_info = {
        "date": date,
        "channel_name": channel,
        "url": `https://github.com/${Config.repository}`,
        "epg_data": []
    };

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
        const targetUrl = `https://github.com/${Config.repository}/releases/latest/download/${Config.branch}.xml`;
        const cacheKey = targetUrl; // XML 文件缓存键
        const xml_res = await jq_fetch(new Request(targetUrl, request), cacheKey);
        const xml_blob = await xml_res.blob();
        init['headers']['content-type'] = 'text/xml';
        return new Response(xml_blob, init);
    }

    let date = uri.searchParams.get("date") || getNowDate();
    date = getFormatTime(date.replace(/\D+/g, ''))['date'];

    channel = channel.replaceAll('-', '').toUpperCase();
    if (parseInt(date.replaceAll('-', '')) >= 20240214) {
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
    event.respondWith(ret);
});

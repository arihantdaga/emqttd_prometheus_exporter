const http = require('http')
const pClient = require('prom-client')
const argv = process.argv;
const Config = require("../config/config");
const request = require("request-promise");

const gaugeProps = [
    {
        name: "client_count",
        help: "This is help"

    },
    {
        name: "retained_count",
        help: "This is help2"
    },
    {
        name: "routes_count",
        help: "This is help3"
    },
    {
        name: "sessions_count",
        help: "This is help"
    },
    {
        name: "subscribers_count",
    },
    {
        name: "subscriptions_count",
    },
    {
        name: "topics_count",
    },
    {
        name: "qos0_recvd",
    },
    {
        name: "qos0_sent",
    },
    {
        name: "qos0_dropped",
    },
    {
        name: "qos1_recvd",
    },
    {
        name: "qos1_sent",
    },
    {
        name: "qos1_dropped",
    },
    {
        name: "qos2_recvd",
    },
    {
        name: "qos2_sent",
    },
    {
        name: "qos2_dropped",
    },
    {
        name: "connect_requests",
    },
    {
        name: "disconnect_requests",
    }
]
const commonGaugeProps = [
    {
        name: "node_count",
        help : "Number of nodes in cluster"
    }
]
const labels = ["nodename"];

function getMetrics(){
    // return pClientise.resolve("Hello");
    let metrics = {};
    pClient.register.clear();
    gaugeProps.map(metric=>{
        metrics[metric.name] = new pClient.Gauge({
            name : prefix + '_' + metric.name,
            help: metric.help,
            labelNames: labelNames
        });
    });
    commonGaugeProps.map(metric=>{
        metrics[metric.name] = new pClient.Gauge({
            name : prefix + '_' + metric.name,
            help: metric.help
        });
    })


    return fetchEmqStats().then(data=>{
        const metrics = data.metrics;
        const stats = data.stats;
        if(!metrics.results || !stats.results){
            // Unknown Response Format
            console.err("Unknow API Response format");
            return;
        }
        
        // From Stats Obtained
        const sRes = stats.results[0];
        Object.keys(sRes).map(node=>{
            if(!sRes.hasOwnProperty(node)) return;
            const labels = {
                nodename: node
            }
            const values = {
                "client_count": sRes[node]["clients/count"],
                "retained_count": sRes[node]["retained/count"],
                "routes_count": sRes[node]["routes/count"],
                "session_count": sRes[node]["sessions/count"],
                "subscribers_count": sRes[node]["subscribers/count"],
                "subscriptions_count": sRes[node]["subscriptions/count"],
                "topics_count":sRes[node]["topics/count"],
            }

            Object.keys(values).map(value=>{
                if(!values.hasOwnProperty(value)) return;
                metrics[value].set(labels, values[value]);
            });
        });

        // From Metrics Obtained
        const mRes = stats.results[0];
        Object.keys(mRes).map(node=>{
            if(!mRes.hasOwnProperty(node)) return;
            const labels = {
                nodename: node
            }
            const values = {
                "qos0_recvd": mRes[node]["messages/qos0/received"],
                "qos0_sent": mRes[node]["messages/qos0/sent"],
                "qos0_dropped": mRes[node]["messages/qos0/dropped"],
                "qos1_recvd": mRes[node]["messages/qos1/received"],
                "qos1_sent": mRes[node]["messages/qos1/sent"],
                "qos1_dropped": mRes[node]["messages/qos1/dropped"],
                "qos2_recvd": mRes[node]["messages/qos2/received"],
                "qos2_sent": mRes[node]["messages/qos2/sent"],
                "qos2_dropped": mRes[node]["messages/qos2/dropped"],
                "connect_requests": mRes[node]["packets/connect"],
                "disconnect_requests": mRes[node]["packets/disconnect"]
            }

            Object.keys(values).map(value=>{
                if(!values.hasOwnProperty(value)) return;
                metrics[value].set(labels, values[value]);
            });
        });

        
        const commonValues = {
            "node_count": _getObjectLength(sRes)
        }
        Object.keys(commonValues).map(value=>{
            if(!commonValues.hasOwnProperty(value)) return;
            metrics[value].set(commonValues[value]);
        });

        return pClient.register.metrics();
    });
}

function fetchEmqStats(){
    const statsOpts = { 
        method: 'GET',
        url: `${Config.apiBase}${Config.emqApis.stats}`,
        'auth': {
            'user': `${Config.emq_username}`,
            'pass': `${Config.emq_password}`,
            'sendImmediately': false
        }
    }
    const metricsOpts = {
        method: 'GET',
        url: `${Config.apiBase}${Config.emqApis.metrics}`,
        'auth': {
            'user': `${Config.emq_username}`,
            'pass': `${Config.emq_password}`,
            'sendImmediately': false
        }
    } 

    return Promise.all([
        request(statsOpts),
        request(metricsOpts)
    ]).then(data=>{
        const stats = JSON.parse(data[0]);
        const metrics = JSON.parse(data[1]);
        return {stats: stats, metrics: metrics};
    });
}

function App(){
    const server = http.createServer(handleRequest);
    server.listen(Config.port);

}
function handleRequest(req,res){
    const url = req.url;
    if(url == "/metrics"){
        getMetrics().then(data=>{
            return res.end(data);
        }).catch(err=>{
            res.writeHead(500);
        res.end();
        })
    }else{
        res.writeHead(404);
        res.end();
    }
}
function _getObjectLength(obj){
    let n = 0
    Object.keys(obj).map(i=>{
        if(obj.hasOwnProperty(i)) n++;
    })
    return n;   
}
// Begin the game
App();

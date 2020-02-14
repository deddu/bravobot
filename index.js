const rp = require('request-promise-native');
const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient();
const TABLE = 'bravobot-scores'
const points = {
    cookie:1,
    doughnut:1,
    beer:1,
    beers:2,
    donutcoin:1,
    hankey:-1,
    shit:-1,
    poop:-1,
    lemon:-1,
    raisins:-1
}

const update_record = (chan, who, how_much) => {
      const params = {
      TableName: TABLE,
      Key: { chan : chan },
      UpdateExpression: 'ADD #a :x',
      ExpressionAttributeNames: {'#a' : who},
      ExpressionAttributeValues: {
        ':x' : how_much,
      },
      ReturnValues: 'NONE'
    };

    return documentClient.update(params).promise()
}

const get_scores = (chan)=>{
    const params = {
        TableName: TABLE,
        Key: {chan:chan}
    }
    return documentClient.get(params)
        .promise()
        .then( x => x.Item)
        .catch(e => {
            console.error(e);
            return {}
        })
}

const fmt_scores = (scores) => {
    const fmt_score = (x) => ({
        type: "section",
        text: {
            type:"mrkdwn",
            text:`<@${x}>: ${scores[x]}`
        }
    })
    const user_scores =  Object.keys(scores)
        .filter(x=>x!='chan')
        .map(fmt_score)
    
    return [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `* <#${scores.chan}> scores:* \t :cookie:|:doughnut:|:beer:|:donutcoin: +1 \t :hankey:|:lemon: -1   `
            }
        },
        {
            type: "divider"
        },
        ... user_scores
    ]

}

async function on_mention( e) {
    let scores = await get_scores(e.channel);
    const blocks = fmt_scores(scores)
    let text_slack = await post_block(blocks, e.channel);
    return {message:scores}
}


async function on_reaction(e, sign=1){
   const where = e.item.channel
   const who = e.user
   const to = e.item_user
   const p = points[e.reaction] |0
   if (!!p){
       await update_record(where, to, sign*p)
   }
   return {message:`${who} gave ${p} to ${to} in ${where}`}
}

const msg_routes = {
        'app_mention' : on_mention,
        'reaction_added' : on_reaction,
        'reaction_removed': (e) => on_reaction(e, -1)
    }

function post_block(blk,chan){
   const payload = {
       blocks:blk,
       channel:chan
   }
   return post_payload(payload )
}

function post_msg(msg,chan){
        const payload = {
            text: msg,
            channel: chan
            }
        return post_payload(payload)
}

function post_payload(payload) {
    const opts = {
        method:'POST',
        uri:'https://slack.com/api/chat.postMessage',
        headers:{
            Authorization: `Bearer ${process.env.BOTS_TOKEN}`
        },
        body:payload,
        json:true
    }
    
    return rp(opts)
}
    
const build_response = o => ({
    statusCode: 200,
    headers: {
            "Content-Type": "Application/json"
        },
    body: JSON.stringify(o),  
    isBase64Encoded: false
})
    
    
exports.handler = async (event) => {
    const slack_raw = JSON.parse(event.body)
    let resp;
    if ('event_callback' == slack_raw.type ) {
        //the event is wrapped in metadata
        const slack_evt = slack_raw.event;
         resp = await msg_routes[slack_evt.type](slack_evt)
    }
    else if ('url_verification' == slack_raw.type){
        resp = {challenge: slack_raw.challenge}
    }
    
    return build_response(resp);
};

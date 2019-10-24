const rp = require('request-promise-native');
const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient();
const TABLE = 'bravobot-scores'



const make_record = (chan)=>({
    chan:chan
})

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
                text: `* <#${scores.chan}> scores:* \t :cookie: +1 \t :hankey: -1   `
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
    // if scores is nil, then we create one empty
    console.log(scores)
    const blocks = fmt_scores(scores)
    console.log(blocks)
    let text_slack = await post_block(blocks, e.channel);
    return {message:scores}
}

const actions = {
    //who did what to who
       'cookie': (chan, who, to) => update_record(chan, to, 1),
       'hankey': (chan, who, to) => update_record(chan, to, -1)
    }

async function on_reaction(e){
   const where = e.item.channel
   const who = e.user
   const to = e.item_user
   const did = await actions[e.reaction](where, who, to)
   console.log(`${who} did ${e.reaction} to ${to} in ${where}`)
   return {message:'ok'}
}

const msg_routes = {
        'app_mention': on_mention,
        'reaction_added':on_reaction,
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
    console.log(slack_raw)
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

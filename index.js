const TeleBot = require('telebot');
const fs = require('fs');
const request = require('request');
const bot = new TeleBot(token);

let db = {};
let rLimit = 10;

function updateUser(userId, subreddit, option, postNum) {
    db[userId] = {subreddit, option, postNum};
}

function sendRedditPost(messageId, subreddit, option, postNum) {
    const options = getOptions(option, rLimit);
    var start = new Date();
    request({ url: `http://www.reddit.com/r/${subreddit}/${options}`, json: true }, function (error, response, body) {
        
        // check if response was successful
        if (!error && response.statusCode === 200) {   
            
            // send error message if the bot encountered one
            if (body.hasOwnProperty('error') || body.data.children.length < 1) {
                return sendErrorMsg(messageId);
            } else if (body.data.children.length - 1 < postNum) {
                return noMorePosts(messageId);
            }
            
            // reddit post data
            let redditPost = body.data.children[postNum].data;
            redditPost.title = redditPost.title.replace(/&amp;/g, '&');

            // inline buttons
            const markup = bot.inlineKeyboard([
                [
                    bot.inlineButton('🌐 Reddit', { url: `https://www.reddit.com${redditPost.permalink}` }),
                    bot.inlineButton('➡️️ Next', { callback: 'callback_query_next' })
                ]
            ]);

            // if post is an image or if it's a gif or a link
            if (/\.(jpe?g|png)$/.test(redditPost.url) || 
                redditPost.domain === 'i.reddituploads.com' || 
                redditPost.domain === 'i.redd.it') {
                // sendPlsWait(messageId);
                return sendImagePost(messageId, redditPost, markup);
            } else if (redditPost.preview && redditPost.preview.images[0].variants.mp4) {
                // sendPlsWait(messageId);
                sendGifPost(messageId, redditPost, markup);
            } else {
                return sendMessagePost(messageId, redditPost, markup);
            }
            
        // unsuccessful response
        } else {
            return sendErrorMsg(messageId);
        }
      });
}

// options
function getOptions(option, rlimit) {
    if (option === 'top') {
        return `top.json?t=day&limit=${rlimit}`;
    } else if (option === 'topw') {
         return `top.json?t=week&limit=${rlimit}`;
    } else if (option === 'topm') {
         return `top.json?t=month&limit=${rlimit}`;
    } else if (option === 'topy') {
         return `top.json?t=year&limit=${rlimit}`;
    } else if (option === 'all') {
        return `top.json?t=all&limit=${rlimit}`;
    } else if (option === 'hot') {
        return `hot.json?&limit=${rlimit}`;
    } else if (option === 'new') {
        return `new.json?&limit=${rlimit}`;
    } else {
        return `top.json?t=day&limit=${rlimit}`;
    }
}

function sendErrorMsg(messageId) {
    const errorMsg = `Couldn't find the subreddit. Use /help for instructions.`;
    return bot.sendMessage(messageId, errorMsg);
}

function sendLimitMsg(messageId) {
    const errorMsg = `Sorry, we can't show more than ${rLimit} posts for one option. Please change your subreddit or option. 

Use /help for instructions.`;
    return bot.sendMessage(messageId, errorMsg);
}

function noMorePosts(messageId) {
    const errorMsg = `No more posts. Use /help for instructions`;
    return bot.sendMessage(messageId, errorMsg);
}

/*function sendPlsWait(messageId) {
    const message = `Please wait...`;
    return bot.sendMessage(messageId, message);
}*/

function sendImagePost(messageId, redditPost, markup) {
    let url = redditPost.url;
    url = url.replace(/&amp;/g, '&');
    let caption = redditPost.title;
    return bot.sendPhoto(messageId, url, {caption, markup});
}

function sendGifPost(messageId, redditPost, markup) {
    let gifArr = redditPost.preview.images[0].variants.mp4.resolutions;
    let gif = gifArr[gifArr.length - 1].url;
    gif = gif.replace(/&amp;/g, '&');
    const caption = redditPost.title;
    return bot.sendVideo(messageId, gif, {caption, markup});
}

function sendMessagePost(messageId, redditPost, markup) {
    let url = redditPost.url;
    url = url.replace(/&amp;/g, '&');
    const message = `${redditPost.title}

${url}`;
    return bot.sendMessage(messageId, message, {markup});
}


bot.on('text', msg => {
    const parse = "Markdown";
    if (msg.text === '/start' || msg.text === '/help') {
        const message = `Enter a subreddit name with an option:

*top:* Top posts from past day
*topw:* Top posts from past week
*topm:* Top posts from past month
*topy:* Top posts from past year
*all:* Top posts of all time
*hot:* Hot posts right now 
*new:* Latest posts

For example if you want to get top posts of \`/r/cats\` enter:
*cats top*

Default option is *top*, so *cats* will return top posts of \`/r/cats\` from past day.`
        return bot.sendMessage(msg.from.id, message, {parse});
    } else {
        const userId = `id_${msg.from.id}`;
        const messageId = msg.from.id;
        const [subreddit, option] = msg.text.toLowerCase().split(' ');
        const postNum = 0;
        updateUser(userId, subreddit, option, postNum);
        sendRedditPost(messageId, subreddit, option, postNum);
    }  
});

bot.on('callbackQuery', msg => {
    if (msg.data === 'callback_query_next') {
        const userId = `id_${msg.from.id}`;
        const messageId = msg.from.id;
        let subreddit = '', 
              option = '';
        let postNum = 0;
        
        if (db[userId].hasOwnProperty('subreddit')) {
            subreddit = db[userId]['subreddit'];
        } else {
            return bot.sendMessage(messageId, 'Sorry, you should send the subreddit again');
        }
        
        if (db[userId]['option']) {
            option = db[userId]['option'];
        } else {
            option = 'top';
        }
        
        if (db[userId].hasOwnProperty('postNum')) {
            postNum = db[userId]['postNum'];
            postNum++;
        }
        
        db[userId]['postNum'] = postNum;
        
        if (postNum > rLimit - 1) {
            return sendLimitMsg(messageId);
        }
        sendRedditPost(messageId, subreddit, option, postNum);
    }
});

bot.connect();
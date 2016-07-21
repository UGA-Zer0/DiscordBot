'use strict';


/////////////////////////
// Import NPM packages //
/////////////////////////

const Discord = require("discord.js"); // the main package. Makes the bot work in the first place.
const settings = require("./settings.json"); // authentication stuff (oauth token) and default settings stored in here.
const func = require("./functions.js"); // a couple of functions are stored here. I might just move them into this file for the sake of simplicity.
const request = require('request'); // require the request package - just so I don't have to use cURL.

const bot = new Discord.Client({ // set up bot object
  autoReconnect: true // automatically attempt to reconnect if the server dies, etc.
});

let queue = [], // create queue as an empty array. URLs will be pushed here as users add them.
    paused = false; // defines whether the playlist is paused. Without this, whenever the playlist is paused the bot thinks the song is finished and skips is. Not ideal.


 ///////////////////
 // Commands List //
 ///////////////////

let commands = [ // command list. Stores each command as an object with the command, description, parameters and execute function.
  {
    //Help command
    command: 'help',
    description: 'Displays the command list.',
    params: [],
    execute: (m, p) => {
      let res = "__***Available commands:***__\n"; // first line - Discord uses markdown formatting, so this will be bold, italic and underlined.

      //Loop through the commands list, grab the command, params and description of each command and build the following string:
      //***!command <par1 par2 ...>***: description.
      for (let i = 0; i < commands.length; i++) {
        let c = commands[i];
        res += "\n***!" + c.command;

        for (let j = 0; j < c.params.length; j++) {
          res += " <" + c.params[j] + ">";
        }

        res += "***: " + c.description;
      }

      bot.sendMessage(m.channel, res);

    }
  },

  //Ping command, mostly just used for testing the bot.
  {
    command: 'ping',
    description: 'Pongs. Just used to test the bot.',
    params: [],
    execute: (m, p) => {
      bot.sendMessage(m.channel, "Pong");
    }
  },

  //Whoami command. Gives the user their client ID. Might add the possibility to get other users' IDs.
  {
    command: 'whoami',
    description: 'Displays your Client ID.',
    params: [],
    execute: (m, p) => {
      bot.reply(m, `your Client ID is ${m.author.id}.`);
    }
  },

  //Summon command. Brings the bot to the user's voice channel if they're in one. Otherwise insults the user.
  {
    command: 'summon',
    description: 'Brings the bot to your voice channel',
    params: [],
    execute: (m, p) => {
      //Check whether the user is in a voice channel
      if (m.author.voiceChannel === null) {
        bot.reply(m, "you're not in a voice channel, you spoon.");
      }
      else {
        let voicechannel = m.author.voiceChannel;

        //Join the user's voice channel, reply to the user in the callback function.
        bot.joinVoiceChannel(voicechannel, (err, vc) => {
          bot.reply(m, `joining your voice channel.`);
        });
      }
    }
  },

  //Announce command. Uses text-to-speech to announce a message to the whole server.
  {
    command: 'announce',
    description: 'Announces a message using TTS',
    params: ["message"],
    execute: (m, p) => {
      if (p[1] !== undefined) {

        //Remove the first element from the p array (the command itself), then join the rest with spaces.
        //Before I did this, the bot was just announcing the first word. Funny, but not particularly useful.
        p.shift();
        let message = p.join(' ');
        bot.sendMessage(m.channel, message, {tts: true});
      }
      else {
        bot.sendMessage(m.channel, "The `message` parameter cannot be empty.");
      }
    }
  },

  //Topic command. Sets the topic in the channel where the message was received.
  {
    command: 'topic',
    description: 'Sets channel topic. Leave the topic parameter blank to remove the topic.',
    params: ['topic'],
    execute: (m, p) => {

      //Same deal as the announce command.
      p.shift();
      let topic = p.join(" ");
      bot.setChannelTopic(m.channel, topic);
    }
  },

  //Gohome command, sends the bot back to its own voice channel - the ID for this channel is stored in the settings.json file.
  {
    command: 'gohome',
    description: 'Sends the bot back to its default voice channel',
    params: [],
    execute: (m, p) => {
      bot.joinVoiceChannel(settings.voiceChannel, (err, vc) => {
        bot.sendMessage(settings.textChannel, `Connecting to Bot Channel.`);
      });
    }
  },

  //Avatar command. Displays the user's avatar URL (if they have one)
  //TODO: add handling for when the user has no avatar. Right now it just prints 'null'.
  {
    command: 'avatar',
    description: 'Displays your avatar URL',
    params: [],
    execute: (m, p) => {
      let avatar = m.author.avatar;
      if (avatar === null) {
        bot.reply(m, `you have no avatar.`);
      }
      else {
        bot.reply(m, `your avatar URL is ${m.author.avatarURL}`);
      }
    }
  },

  //Play command. Adds a song to the queue.
  //TODO: change the name of this command - play suggests that it will start playing instantly. Maybe 'add' or 'request'.
  {
    command: 'play',
    description: 'Plays the requested video, or adds it to the queue.',
    params: ["Youtube URL"],
    execute: (m, p) => {
      let videoId = func.getVideoId(p[1]);
      play(videoId, m);
    }
  },

  //Stops playback and clears the whole queue.
  {
    command: 'stop',
    description: 'Stops the current song and clears the queue.',
    params: [],
    execute: (m, p) => {
      bot.sendMessage(m.channel, "Stopping...");
      bot.voiceConnection.stopPlaying();
      queue = [];
    }
  },

  //Pauses playback. Sets the pause variable to true so that the checkQueue function doesn't think the song has ended.
  {
    command: 'pause',
    description: 'Pauses the current playlist.',
    params: [],
    execute: (m, p) => {
      //Check if playback is already paused.
      if (!paused) {
        bot.voiceConnection.pause();
        paused = true;
        bot.sendMessage(m.channel, "Playback has been paused.");
      }
      else {
        bot.sendMessage(m.channel, "Playback is already paused.");
      }
    }
  },

  //Resumes the playlist, if it is paused.
  {
    command: 'resume',
    description: 'Resumes the playlist',
    params: [],
    execute: (m, p) => {
      if (!paused) {
        bot.sendMessage(m.channel, "Playback isn't paused.");
      }
      else {
        bot.voiceConnection.resume();
        paused = false
        bot.sendMessage(m.channel, "Playback resumed.");
      }
    }
  },

  //Skip the current song in the queue, play the next one.
  {
    command: 'skip',
    description: 'Skips the current song.',
    params: [],
    execute: (m, p) => {
      playNext();
    }
  },

  //Set the volume of the bot. 100% is loud. Very loud.
  {
    command: 'volume',
    description: 'Sets the volume of the bot between 0-200%',
    params: ['percentage'],
    execute: (m, p) => {
      if (p[1] <= 200 && p[1] >= 0) {
        bot.voiceConnection.setVolume(p[1]/100); // volume is actually set between 0 and 2, but percentages are easier for users to understand.
        bot.sendMessage(m.channel, `Setting volume to ${p[1]}%`);
      }
      else {
        bot.sendMessage(m.channel, 'Volume must be set between 0% and 200%. '+p[1]+' is not a valid volume.');
      }
    }
  }

];


///////////////////////
// Create Bot Events //
///////////////////////

//When the bot object is created, run this function
bot.once('ready', () => {
  //Dump the bot's username and ID in the console. Just for testing purposes.
  console.log(`${bot.user.username} (${bot.user.id}) joined. Serving in ${bot.channels.length} channels`); //Log when the bot joins. I don't do much logging right now. Just this and errors.

  //Join the default voice channels
  bot.joinVoiceChannel(settings.voiceChannel, (err, vc) => { //Join the default voice channel defined in the settings.json file
    bot.sendMessage(settings.textChannel, `Bot ${bot.user.username} connected. Type ***!help*** to view a list of commands.`); //The bot will say this message every time it connects.
  });

  //Begin watching the queue.
  checkQueue();
});

//When a message is posted in the text channel
bot.on('message', (m) => {
  if (m.author.id !== bot.user.id) { // <--- check that the bot didn't send the message. Very important. Mistakes were made.
    if (m.channel.topic !== undefined) { // <--- If channel topic is undefined, then this is a DM to the bot. We don't want to run commands in a DM. It breaks things.
      if (m.content[0] == "!") { // <--- Check if the first character of the message is a !.
        executeCommand(m, m.content.substring(1)); // If the first character is !, run executeCommand.
      }
      else if (m.isMentioned(bot.user.id)) { // If the message doesn't start with !, but the bot is mentioned in it
        bot.reply(m, "Use !help to see a command list."); // Display a pseudo-help message.
      }
    }
  }
});

bot.on("serverNewMember", user => { // When a new user joins the server
  bot.sendMessage(settings.textChannel, `${user.username} joined the server`); // Give them a greeting message.
})

bot.loginWithToken(settings.token); // This actually logs the bot in using the oauth token in settings.json


/////////////////////
// Other functions //
/////////////////////

function executeCommand(m, c) { // Called when the user types a command in chat
  let params = c.split(' '); // Split the command into individual words.
  let command = null; // used in the loop below

  for (let i = 0; i < commands.length; i++) { // Loop through commands array
    if (commands[i].command == params[0].toLowerCase()) { // Check if command matches the one typed
      command = commands[i]; // Set it to variable 'command'. Maybe break out of the loop. I'll sort that out later.
    }
  }

  if (command !== null) { // If no matching command was set in the loop, 'command' will still be null. Otherwise, run the command.
    if (params.length-1 < command.params.length) { // check that the command has enough parameters. Might move this check to the command itself, since some params are optional.
      bot.reply(m, 'Insufficient parameters'); // Reply to the user, tell them to add params.
      //TODO: detect which command was used and display the help message for it
    }
    else {
      command.execute(m, params); // Run the 'execute' function stored in the command object.
    }
  }
}

function play(id, m) { // called when a user requests a song to add to the queue
  let baseURL = "https://savedeo.com/download?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D"; // using savedeo to download and play audio files.

  request (baseURL + id, (err, res, body) => { // Append the youtube video ID to the base URL and request the page contents
    if (!err && res.statusCode == 200) { // check that no errors are thrown and the HTTP response is 200 (success)
      let cheerio = require('cheerio'), $ = cheerio.load(body); // load the response body with cheerio
      let videoTitle = $('title').text(); // set the video title to the title of the page.
      let audioUrl = $('#main div.clip table tbody tr th span.fa-music').first().parent().parent().find('td a').attr('href'); // horrible selector query to get the first URL to an audio file

      queue.push({ // push this file to the queue
        title: videoTitle, // this is all self-explanatory. Just storing data about the song.
        user: m.author.username,
        url: audioUrl
      });

      bot.sendMessage(m.channel, `"${videoTitle}" has been added to the queue by ${m.author.username}`); // Tell everyone what song was added and by who.
    }
    else { // If 'err' exists, or response code is not 200.
      bot.sendMessage(m.channel, "There was an issue handling your request."); // generic error message
      console.log("Error requesting video: " + err); // log stuff
    }
  })
}

function checkQueue() { // called every 5 seconds.
  if (queue.length !== 0 && !bot.voiceConnection.playing && !paused) { // check that the queue is not empty, the bot is not playing something, and the playlist is not paused.
    playNext(); // play next song if above conditions are met
  }
  setTimeout(checkQueue, 5000); // run this function again in 5 seconds
}

function playNext() { // called when a user runs the !stop command, or when a song ends
  bot.voiceConnection.playFile(queue[0]['url']); // play the first song in the queue. This song is then removed, so the first song is the next song. Makes sense?
  bot.sendMessage(settings.textChannel, 'Now playing "'+queue[0]['title']+'", requested by '+queue[0]['user']); // more messaging
  queue.splice(0,1); // Remove the song we just played from the queue, so queue[0] is always the next song.
}

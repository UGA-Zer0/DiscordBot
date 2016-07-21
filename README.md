## DiscordBot

*A music and chat bot for Discord*

### Usage

This assumes you already have a Discord application set up with a bot account.

1. `git clone`
2. Modify the `settings.json.default` file to include your bot's oauth token, the ID of the default text channel, and the ID of the voice channel you want it to connect to on join.
3. Rename `settings.json.default` to `settings.json`
4. Run `npm install` to grab dependencies.
5. Run `main.js`.

### Notes

* The music function will not work if the bot is running from a Windows machine. It might work if you install ffmpeg and add it to your PATH. I haven't tested that yet.
* For the bot to run in the background, I recommend using [forever.js](https://github.com/foreverjs/forever). Run `npm install -g forever`, navigate to the folder where the bot is stored, and run `forever start main.js`.

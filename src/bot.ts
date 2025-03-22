import { Client, Events, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { Logger, LogLevel } from "meklog";

import commands from "./commands/commands";

dotenv.config();

export const CHANNELS = process.env.CHANNELS ? process.env.CHANNELS.split(",") : [];

const production = process.env.NODE_ENV === "prod" || process.env.NODE_ENV === "production";
export let log = Logger({ production, prefix: "Bot" });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { users: [], roles: [], repliedUser: false },
  partials: [Partials.Channel],
});
interface ProcessMessageData {
  shardID: number;
  logger: Logger;
}

if (!process.env.DISCORD_TOKEN) {
  throw new Error("No token provided.");
}
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

process.on("message", (data: ProcessMessageData) => {
  if (data.shardID && client.shard) {
    Object.defineProperty(client.shard, "ids", { value: [data.shardID] });
  }
  if (data.logger) log = Logger(data.logger);
});

client.once(Events.ClientReady, async bot => {
  await bot.guilds.fetch();
  bot.user.setPresence({ activities: [], status: "online" });
  const body = await Promise.all(
    commands.map(async command => {
      return (await command(true)).command;
    })
  );
  await rest.put(Routes.applicationCommands(bot.user.id), {
    body,
  });

  log(LogLevel.Info, "Successfully reloaded application slash (/) commands.");
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.author.id || message.author.id === client.user?.id) return;
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (
    CHANNELS.length > 0 &&
    !CHANNELS.includes(interaction.channelId) &&
    commandName !== "channels"
  ) {
    await interaction.reply({
      content: "This command is not available in this channel.",
      ephemeral: true,
    });
    return;
  }

  for (const command of commands) {
    const name = (await command()).command.name;
    if (name === commandName) {
      (await command()).handler(interaction);
      return;
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

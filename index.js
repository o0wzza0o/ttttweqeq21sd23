const { Client, Intents,MessageEmbed } = require('discord.js');
const keep_alive = require('./keep_alive.js')
const fs = require('fs');

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS
    ]
});
const welcomeChannels = ['1271224716191076424', '1270856168985853974', '1270855715896164392'];

client.on('guildMemberAdd', async (member) => {
    const welcomeMessage = `- **Check Here <@${member.user.id}>**`;

    for (const channelId of welcomeChannels) {
        const channel = member.guild.channels.cache.get(channelId);

        if (channel) {
            const sentMessage = await channel.send(welcomeMessage);
            setTimeout(() => {
                sentMessage.delete().catch(console.error);
            }, 20000); // 30 ثانية
        }
    }
});

let voicesList = {};
if (fs.existsSync('voiceslist.json')) {
    voicesList = JSON.parse(fs.readFileSync('voiceslist.json'));
}

function saveVoicesList() {
    fs.writeFileSync('voiceslist.json', JSON.stringify(voicesList, null, 4));
}

function updateTimeForMembers() {
    const now = Date.now();
const guild = client.guilds.cache.first();
    if (!guild) return;

    for (const memberId in voicesList) {
        if (voicesList[memberId].status === 'online' && voicesList[memberId].startTime) {
            const member = guild.members.cache.get(memberId);

            if (member && member.voice.deaf) {
                voicesList[memberId].startTime = now;
            } else {
                const timeSpent = (now - voicesList[memberId].startTime) / 1000; 
                voicesList[memberId].totalTime += timeSpent;
                voicesList[memberId].startTime = now;
            }
        }
    }
    saveVoicesList();
}

setInterval(updateTimeForMembers, 3000);

function addTime(memberId, timeToAddInSeconds) {
    if (!voicesList[memberId]) {
        voicesList[memberId] = { totalTime: 0 };
    }
    voicesList[memberId].totalTime += timeToAddInSeconds;
    saveVoicesList();
}

async function updateMemberStatuses() {
    const guild = client.guilds.cache.first(); 
    if (!guild) return;

    const voiceStates = guild.voiceStates.cache;
    for (const memberId in voicesList) {
        const member = guild.members.cache.get(memberId);
        if (member) {
            if (voiceStates.has(memberId)) {
                voicesList[memberId].status = 'online';
            } else {
                voicesList[memberId].status = 'offline';
            }
        } else {
            voicesList[memberId].status = 'offline';
        }
    }
    saveVoicesList();
}

// مراقبة التغيرات في الحالة الصوتية للأعضاء
client.on('voiceStateUpdate', (oldState, newState) => {
    const member = newState.member;

    // المستخدم انتقل من غرفة صوتية إلى أخرى
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        if (voicesList[member.id] && voicesList[member.id].startTime) {
            const timeSpent = (Date.now() - voicesList[member.id].startTime) / 1000; // بالثواني
            voicesList[member.id].totalTime += timeSpent;
        }

        // بدء تتبع الوقت في الغرفة الجديدة
        voicesList[member.id] = {
            startTime: Date.now(),
            totalTime: voicesList[member.id]?.totalTime || 0,
            status: 'online' // تعيين الحالة إلى "online" عند الانضمام إلى غرفة صوتية جديدة
        };
        saveVoicesList();
    }

    // المستخدم انضم لروم صوتي جديد ولم يكن في روم صوتي سابقًا
    else if (newState.channelId && !oldState.channelId) {
        voicesList[member.id] = {
            startTime: Date.now(),
            totalTime: voicesList[member.id]?.totalTime || 0,
            status: 'online'
        };
        saveVoicesList();
    }

    else if (!newState.channelId && oldState.channelId) {
        if (voicesList[member.id] && voicesList[member.id].startTime) {
            const timeSpent = (Date.now() - voicesList[member.id].startTime) / 1000; // بالثواني
            voicesList[member.id].totalTime += timeSpent;
            delete voicesList[member.id].startTime;
            voicesList[member.id].status = 'offline'; 
            saveVoicesList();
        }
    }
});

client.on('messageCreate', (message) => {
    if (message.content.startsWith('!showvoiceslist')) {
        let response = 'Top List\n';

        const sortedMembers = Object.entries(voicesList)
            .sort(([, a], [, b]) => b.totalTime - a.totalTime);

        for (const [memberId, data] of sortedMembers) {
            const totalTimeInSeconds = data.totalTime || 0;
            const hours = Math.floor(totalTimeInSeconds / 3600);
            const minutes = Math.floor((totalTimeInSeconds % 3600) / 60);
            const seconds = Math.floor(totalTimeInSeconds % 60);
            
            const member = message.guild.members.cache.get(memberId);
            if (member) {
                response += `Member: <@${member.user.id}> | Time: ${hours}h, ${minutes}m, ${seconds}s | Status: ${data.status || 'offline'}\n`;
            } else {
                response += `Member ID: <@${memberId}> | Time: ${hours}h, ${minutes}m, ${seconds}s | Status: ${data.status || 'offline'}\n`;
            }
        }

        message.channel.send(response);
        
    }



    if (message.content.startsWith('!addhours') || message.content.startsWith('!addminutes')) {
        const args = message.content.split(' ');
        const mentionedMember = message.mentions.members.first();

        if (!mentionedMember) {
            return message.reply('يرجى ذكر المستخدم الذي تريد إضافة الوقت له.');
        }

        const timeValue = parseInt(args[2]);
        if (isNaN(timeValue)) {
            return message.reply('يرجى تحديد قيمة زمنية صحيحة.');
        }

        if (message.content.startsWith('!addhours')) {
            const timeToAddInSeconds = timeValue * 3600; 
            addTime(mentionedMember.id, timeToAddInSeconds);
            message.reply(`تمت إضافة ${timeValue} ساعة إلى ${mentionedMember}.`);
        } else if (message.content.startsWith('!addminutes')) {
            const timeToAddInSeconds = timeValue * 60; 
            addTime(mentionedMember.id, timeToAddInSeconds);
            message.reply(`تمت إضافة ${timeValue} دقيقة إلى ${mentionedMember}.`);
        }
    }
    if (message.content.startsWith('!mytotaltime')) {
        const memberId = message.author.id;
        const data = voicesList[memberId] || { totalTime: 0 };

        const totalTimeInSeconds = data.totalTime || 0;
        const hours = Math.floor(totalTimeInSeconds / 3600);
        const minutes = Math.floor((totalTimeInSeconds % 3600) / 60);
        const seconds = Math.floor(totalTimeInSeconds % 60);

        message.reply(`Your Total Time: ${hours}h, ${minutes}m, ${seconds}s`);
    }
    const targetChannelId = '1270856363869868156'; 

    if (message.content.startsWith('!top')) {
        if (message.channel.id === targetChannelId) {
            let embed = new MessageEmbed()
                .setTitle('Top List')
                .setColor('#00ff00')
                .setFooter('To Show All Commands Use "!help"')
                .setThumbnail(message.guild.iconURL({ dynamic: true })) 
                .setImage('https://cdn.discordapp.com/attachments/1271496480796184699/1271496508814000208/Picsart_24-08-09_18-52-28-936.jpg?ex=66b78ce6&is=66b63b66&hm=2854bf18e801f3d6c45a12544b4f1b47723664930278bdf40e2a795cecd16847&'); // الصورة الكبيرة التي تريد إضافتها

            const sortedMembers = Object.entries(voicesList)
                .sort(([, a], [, b]) => b.totalTime - a.totalTime)
                .slice(0, 12); 

            sortedMembers.forEach(([memberId, data], index) => {
                const totalTimeInSeconds = data.totalTime || 0;
                const hours = Math.floor(totalTimeInSeconds / 3600);
                const minutes = Math.floor((totalTimeInSeconds % 3600) / 60);
                const seconds = Math.floor(totalTimeInSeconds % 60);

                let medal = '';
                if (index === 0) {
                    medal = '🥇'; 
                } else if (index === 1) {
                    medal = '🥈'; 
                } else if (index === 2) {
                    medal = '🥉'; 
                }

                const member = message.guild.members.cache.get(memberId);
                const rank = index + 1; 
                if (member) {
                    embed.addField(`${medal} Rank ${rank}`, ` <@${member.user.id}> **Time: ${hours}h, ${minutes}m**`, true);
                } else {
                    embed.addField(`${medal} Rank ${rank}`, ` <@${memberId}> **Time: ${hours}h, ${minutes}m**`, true);
                }
            });

            message.channel.send({ embeds: [embed] });
        } else {
            const targetChannel = message.guild.channels.cache.get(targetChannelId);
            if (targetChannel && targetChannel.isText()) {
                targetChannel.send(`<@${message.author.id}>, use the command here.`);
            }
        }
    }

    if (message.content.startsWith('!alltop')) {
        const membersPerPage = 10; 
        const sortedMembers = Object.entries(voicesList)
            .sort(([, a], [, b]) => b.totalTime - a.totalTime);
    
        const totalPages = Math.ceil(sortedMembers.length / membersPerPage);  
    
        for (let page = 0; page < totalPages; page++) {
            let embed = new MessageEmbed()
                .setTitle(`Top List (Page: ${page + 1}/${totalPages})`)
                .setColor('#00ff00')
                .setFooter('To Show All Commands Use " !help "')
                .setThumbnail(message.guild.iconURL({ dynamic: true })) 
                .setImage('https://cdn.discordapp.com/attachments/1271496480796184699/1271496508814000208/Picsart_24-08-09_18-52-28-936.jpg?ex=66b78ce6&is=66b63b66&hm=2854bf18e801f3d6c45a12544b4f1b47723664930278bdf40e2a795cecd16847&'); // الصورة الكبيرة التي تريد إضافتها
    
            const start = page * membersPerPage;
            const end = start + membersPerPage;
            const membersOnPage = sortedMembers.slice(start, end);
    
            membersOnPage.forEach(([memberId, data], index) => {
                const totalTimeInSeconds = data.totalTime || 0;
                const hours = Math.floor(totalTimeInSeconds / 3600);
                const minutes = Math.floor((totalTimeInSeconds % 3600) / 60);
                
                let medal = '';
                const overallRank = start + index + 1; 
                if (overallRank === 1) {
                    medal = '🥇'; 
                } else if (overallRank === 2) {
                    medal = '🥈'; 
                } else if (overallRank === 3) {
                    medal = '🥉'; 
                }
    
                const member = message.guild.members.cache.get(memberId);
                if (member) {
                    embed.addField(`${medal} Rank ${overallRank}`, `<@${member.user.id}>
                        **Time: ${hours}h, ${minutes}m**`, true);
                } else {
                    embed.addField(`${medal} Rank ${overallRank}`, `<@${memberId}>
                        **Time: ${hours}h, ${minutes}m**`, true);
                }
            });
    
            message.channel.send({ embeds: [embed] });
        }
    }
    
    if (message.content.startsWith('!myrank')) {
        const memberId = message.author.id;
        const sortedMembers = Object.entries(voicesList)
            .sort(([, a], [, b]) => b.totalTime - a.totalTime);
        
        const rank = sortedMembers.findIndex(([id]) => id === memberId) + 1;

        if (rank === 0) {
            message.reply('You don\'t have a rank');
        } else {
            message.reply(`Your Rank: ${rank}`);
        }
    }
    if (message.content.startsWith('!help')) {
        const embed = new MessageEmbed()
            .setTitle('Riot Egypt')
            .setColor('#00ff00')
            .setDescription(`
                **قائمة الأوامر:**
               - **!top**
 - لعرض اوائل المراكز بترتيب الوقت
- **!alltop**
 - لعرض جميع المراكز بترتيب الوقت
- **!myrank**
 - لعرض مركزك
- **!mytotaltime**
 - لعرض الوقت الذي قضيه داخل الفويزات
            `)
            .setThumbnail(message.guild.iconURL({ dynamic: true })) // صورة مصغرة (صورة السرفر)
            .setImage('https://cdn.discordapp.com/attachments/1271496480796184699/1271575905889685544/Picsart_24-08-10_00-07-59-079.jpg?ex=66b7d6d8&is=66b68558&hm=de22585daada5712cb074575d640916b77d40d567a98fe5af26c7447d2d488c8&') // الصورة الكبيرة التي تريد إضافتها
            .setFooter('For more information, use "!help"');
    
        message.reply({ embeds: [embed] });
    }
    
});

client.on('messageCreate', async message => {
    if (message.content === '!disconnected' && message.member.permissions.has('MOVE_MEMBERS')) {
        const voiceChannels = message.guild.channels.cache.filter(channel => channel.type === 'GUILD_VOICE');

        for (const [channelId, channel] of voiceChannels) {
            for (const [memberId, member] of channel.members) {
                await member.voice.disconnect();
                console.log(`تم طرد ${member.user.tag} من الروم الصوتي.`);
            }
        }

        // حذف ملف voiceslist.json
        if (fs.existsSync('voiceslist.json')) {
            fs.unlinkSync('voiceslist.json');
            console.log('تم حذف ملف voiceslist.json.');
        }

        message.reply('تم طرد جميع الأعضاء من الرومات الصوتية وتم حذف ملف voiceslist.json.');
    }
});
client.on('ready', async () => {
    console.log(`تم تسجيل الدخول باسم ${client.user.tag}`);
    await updateMemberStatuses(); 
}); 
 
const targetChannelId = '1248330325474672640';

client.login('YOUR_BOT_TOKEN');

function monitorConsole(channel) {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = function(...args) {
        originalLog.apply(console, args);
        if (channel) {
            channel.send('**Log:** ' + args.join(' '));
        }
    };

    console.error = function(...args) {
        originalError.apply(console, args);
        if (channel) {
            channel.send('**Error:** ' + args.join(' '));
        }
    };

    console.warn = function(...args) {
        originalWarn.apply(console, args);
        if (channel) {
            channel.send('**Warn:** ' + args.join(' '));
        }
    };
}

client.once('ready', () => {
    const targetChannel = client.channels.cache.get(targetChannelId);
    if (targetChannel) {
        monitorConsole(targetChannel);
        console.log('Console monitoring started.');
    } else {
        console.error(`Could not find the channel with ID: ${targetChannelId}`);
    }
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.stack || error);
    const targetChannel = client.channels.cache.get(targetChannelId);
    if (targetChannel) {
        targetChannel.send('**Uncaught Exception:** ' + (error.stack || error.message || error))
            .catch(console.error);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason.stack || reason);
    const targetChannel = client.channels.cache.get(targetChannelId);
    if (targetChannel) {
        targetChannel.send('**Unhandled Rejection:** ' + (reason.stack || reason.message || reason))
            .catch(console.error);
    }
});
client.login(process.env.TOKEN);

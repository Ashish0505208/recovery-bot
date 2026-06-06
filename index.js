require("dotenv").config();

const fs=require("fs");
const path=require("path");
const {Client,GatewayIntentBits}=require("discord.js");

const TOKEN=process.env.TOKEN;




const client=new Client({
    intents:[
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const dataDir=path.join(__dirname,"data");

if(!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir,{recursive:true});
}


const SUPER_ADMIN_ID="823428938885103616";

const ADMINS_FILE=path.join(dataDir,"admins.json");

if(!fs.existsSync(ADMINS_FILE)){
    fs.writeFileSync(
        ADMINS_FILE,
        JSON.stringify({
            admins:[SUPER_ADMIN_ID]
        },null,2)
    );
}

function getControlGuildId(){
    return getServerConfig().controlGuildId;
}

const SERVER_FILE=path.join(dataDir,"server.json");

if(!fs.existsSync(SERVER_FILE)){
    fs.writeFileSync(
        SERVER_FILE,
        JSON.stringify({
            guildId:"1511040512327684306",
            controlGuildId:"1511040512327684306",
            name:"The GLP1 Chat"
        },null,2)
    );
}

function getServerConfig(){
    try{
        return JSON.parse(
            fs.readFileSync(SERVER_FILE,"utf8")
        );
    }catch{
        return {
            guildId:"",
            name:"Community"
        };
    }
}

function getGuildId(){
    return getServerConfig().guildId;
}

function getServerName(){
    return getServerConfig().name;
}

function setServerConfig(guildId,name){

    const config=getServerConfig();

    fs.writeFileSync(
        SERVER_FILE,
        JSON.stringify(
            {
                guildId,
                controlGuildId:config.controlGuildId,
                name
            },
            null,
            2
        )
    );
}

function getAdmins(){
    try{
        return JSON.parse(
            fs.readFileSync(ADMINS_FILE,"utf8")
        ).admins || [];
    }catch{
        return [SUPER_ADMIN_ID];
    }
}

function saveAdmins(admins){
    fs.writeFileSync(
        ADMINS_FILE,
        JSON.stringify(
            {admins},
            null,
            2
        )
    );
}

function isAdmin(userId){
    return getAdmins().includes(userId);
}


const MEMBERS_FILE=path.join(dataDir,"members.json");

if(!fs.existsSync(MEMBERS_FILE)){
    fs.writeFileSync(MEMBERS_FILE,"{}");
}

function loadData(){
    try{
        return JSON.parse(
            fs.readFileSync(MEMBERS_FILE,"utf8")
        );
    }catch(error){
        console.error(error);
        return {};
    }
}

function saveData(data){
    fs.writeFileSync(
        MEMBERS_FILE,
        JSON.stringify(data,null,2)
    );
}

const BACKUP_FILE=path.join(dataDir,"backupServer.json");

if(!fs.existsSync(BACKUP_FILE)){
    fs.writeFileSync(
        BACKUP_FILE,
        JSON.stringify({
            invite:"https://discord.gg/tY2WbTtz4P"
        },null,2)
    );
}

function getBackupInvite(){
    try{
        const data=JSON.parse(
            fs.readFileSync(BACKUP_FILE,"utf8")
        );

        return data.invite;
    }catch(error){
        console.error(error);
        return null;
    }
}

function setBackupInvite(invite){
    fs.writeFileSync(
        BACKUP_FILE,
        JSON.stringify(
            {invite},
            null,
            2
        )
    );
}

function sleep(ms){
    return new Promise(resolve=>setTimeout(resolve,ms));
}

async function syncGuildMembers(guildId){

    const guild=client.guilds.cache.get(guildId);

    if(!guild){
        throw new Error("Guild not found");
    }

    await guild.members.fetch();

    const data=loadData();

    data[guild.id]={};

    guild.members.cache.forEach(member=>{

        if(member.user.bot) return;

        data[guild.id][member.id]={
            username:member.user.username
        };

    });

    saveData(data);

    return Object.keys(data[guild.id]).length;
}

async function startRecovery(){

    const data=loadData();

    if(!data[getGuildId()]){
        return {
            success:0,
            failed:0,
            total:0
        };
    }

    const users=Object.keys(data[getGuildId()]);


    let success=0;
    let failed=0;

    for(const userId of users){

        try{

            const user=await client.users.fetch(userId);

            await user.send(
`⚠️ Community Recovery Notice

${getServerName()} is currently unavailable or compromised.

Please join the backup server:

${getBackupInvite()}`
            );

            success++;



            await sleep(1500);

        }catch(error){

            failed++;

            
            
        }
    }


    return {
    success,
    failed,
    total:users.length};
}

client.once("ready",async()=>{

    console.log(`Logged in as ${client.user.tag}`);

    const guild=client.guilds.cache.get(getGuildId());

    if(!guild){
        console.log("Guild not found.");
        return;
    }


    await guild.members.fetch();

    const data=loadData();

    data[guild.id]={};

    guild.members.cache.forEach(member=>{

        if(member.user.bot) return;

        data[guild.id][member.id]={
            username:member.user.username
        };

    });

    saveData(data);


});

client.on("guildMemberAdd",member=>{

    if(member.guild.id!==getGuildId()) return;
    if(member.user.bot) return;

    const data=loadData();

    if(!data[member.guild.id]){
        data[member.guild.id]={};
    }

    data[member.guild.id][member.id]={
        username:member.user.username
    };

    saveData(data);


});

client.on("guildMemberRemove",member=>{

    if(member.guild.id!==getGuildId()) return;

    const data=loadData();

    if(
        data[member.guild.id] &&
        data[member.guild.id][member.id]
    ){
        delete data[member.guild.id][member.id];

        saveData(data);
    }


});

client.on("messageCreate",async(message)=>{

    if(message.author.bot) return;

    if(message.guild?.id!==getControlGuildId()) return;

    if(!isAdmin(message.author.id)){
        return;
    }

    if(message.content==="!!recover"){

        await message.reply(
            "Starting recovery notifications..."
        );

        const result=await startRecovery();

        await message.channel.send(
        `**Recovery process completed.**

        - Total Users: ${result.total} | Successful DMs: ${result.success} | Failed DMs: ${result.failed}`
        );
    }

    if(message.content==="!!backupshow"){

        return message.reply(
            `Current backup invite:\n${getBackupInvite()}`
        );
    }

    if(message.content.startsWith("!!backupchange ")){

        const invite=message.content
            .replace("!!backupchange ","")
            .trim();

        if(!invite){
            return message.reply(
                "Usage: !!backupchange <invite>"
            );
        }

        setBackupInvite(invite);

        return message.reply(
            `Backup invite updated.\n${invite}`
        );
    }

    if(message.content.startsWith("!!adminadd ")){

        const userId=message.content
            .replace("!!adminadd ","")
            .trim()
            .replace(/[<@!>]/g,"");

        const admins=getAdmins();

        if(admins.includes(userId)){
            return message.reply("Already an admin.");
        }

        admins.push(userId);

        saveAdmins(admins);

        return message.reply(
            `Added admin: ${userId}`
        );
    }

    if(message.content.startsWith("!!adminremove ")){

        const userId=message.content
            .replace("!!adminremove ","")
            .trim()
            .replace(/[<@!>]/g,"");

        if(userId===SUPER_ADMIN_ID){
            return message.reply(
                "Cannot remove the super admin."
            );
        }

        const admins=getAdmins();

        const updated=admins.filter(
            id=>id!==userId
        );

        saveAdmins(updated);

        return message.reply(
            `Removed admin: ${userId}`
        );
    }

    if(message.content==="!!admins"){

        return message.reply(
            `Admins:\n${getAdmins().join("\n")}`
        );
    }

    if(message.content==="!!serverinfo"){

        const config=getServerConfig();

        return message.reply(
    `Server Name: ${config.name}
    Guild ID: ${config.guildId}`
        );
    }

    if(message.content.startsWith("!!serverchange ")){

        const args=message.content
            .replace("!!serverchange ","")
            .split("|");

        if(args.length!==2){
            return message.reply(
                "Usage: !!serverchange guildId|serverName"
            );
        }

        const guildId=args[0].trim();
        const name=args[1].trim();

        setServerConfig(guildId,name);

        try{

            const count=await syncGuildMembers(guildId);

            return message.reply(
        `Updated server configuration

        Guild ID: ${guildId}
        Name: ${name}

        Synced ${count} members.`
            );

        }catch(error){

            return message.reply(
        `Server updated but sync failed.

        Reason:
        ${error.message}`
            );
        }
    }

    if(message.content==="!!help"){

        return message.reply(
    `╔══════════════════════════════╗
        RECOVERY BOT COMMANDS
╚══════════════════════════════╝

    📢 Recovery Commands
    ━━━━━━━━━━━━━━━━━━
    !!recover
    ↳ Starts the recovery process, It's a dangerous command as it sends 1000's of DM's so use it carefully 

    📦 Backup Server Commands
    ━━━━━━━━━━━━━━━━━━
    !!backupshow
    ↳ Shows the current backup invite.

    !!backupchange <invite>
    ↳ Updates the backup server invite.

    🛡️ Protected Server Commands
    ━━━━━━━━━━━━━━━━━━
    !!serverinfo
    ↳ Displays current protected server information.

    !!serverchange <guildId>|<serverName>
    ↳ Changes the protected server and syncs members.

    Example:
    !!serverchange 1511040512327684306|Lazarus

    👑 Admin Commands
    ━━━━━━━━━━━━━━━━━━
    !!admins
    ↳ Shows all bot admins.

    !!adminadd <userId/@user>
    ↳ Grants admin access.

    !!adminremove <userId/@user>
    ↳ Removes admin access.

    ⚙️ Automatic Features
    ━━━━━━━━━━━━━━━━━━
    • Tracks member joins
    • Tracks member leaves
    • Updates members.json automatically
    • Syncs new protected servers
    • Stores backup server invite
    • Only bot admins can use commands

    ━━━━━━━━━━━━━━━━━━
    Developed for Disaster Recovery
    ━━━━━━━━━━━━━━━━━━`
        );
    }

    if(message.content==="!!count"){

        const data=loadData();

        const guildId=getGuildId();

        const count=data[guildId]
            ? Object.keys(data[guildId]).length
            : 0;

        return message.reply(
            `📊 ${getServerName()}\n\nGuild ID: ${guildId}\nStored Members: ${count}`
        );
    }

});

client.login(TOKEN);
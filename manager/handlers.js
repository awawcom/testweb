const models = require('./models');
const db = require('../database');

module.exports = (bot) => {
    bot.action(`manager_postoyaniki`, async (ctx)=>{
        if(ctx.res.status === 1){
            const { text, keyboard } = await models.getPostoyaniki(ctx.res.zavod);
            return ctx.editMessageText(text, {reply_markup: {inline_keyboard: keyboard}, parse_mode: 'HTML'})
        }
    })
    bot.action(/get_manager_postoyanik:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 1){
            const { text, keyboard } = await models.getPostoyanik(Number(ctx.match[1]));
            return ctx.editMessageText(text, {reply_markup: {inline_keyboard: keyboard}, parse_mode: 'HTML'})
        }
    })
    bot.action(/delete_postoyanik:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 1){
            await db.updateForm(Number(ctx.match[1]), `postoyanik`, 0);
            ctx.answerCbQuery(`Постоянник удален`, {show_alert: true})
            const { text, keyboard } = await models.getPostoyaniki(ctx.res.zavod);
            return ctx.editMessageText(text, {reply_markup: {inline_keyboard: keyboard}, parse_mode: 'HTML'})
        }
    })
    bot.action(/create_form_of_postoyanik:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 1){
            ctx.deleteMessage()
            return ctx.scene.enter('create_form_of_postoyanik', {fid: Number(ctx.match[1])})
        }
    })
};
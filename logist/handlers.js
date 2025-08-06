const models = require('./models');
const index = require('../index');
const db = require('../database');
const {status} = require(`../data`)

module.exports = (bot) => {
    bot.hears(`📋 Неотработанные заявки (Созданные)`, async (ctx)=>{
        if(ctx.res.status === 2) {
            const {text, keyboard} = await models.getAcceptedForms(ctx.res.zavod);
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.hears(`📅 Список заявок на неделю`, async (ctx)=>{
        if(ctx.res.status === 2) {
            const {text, keyboard} = await models.getAllForms(ctx.res.zavod);
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.hears(`📅 Заявки на сегодня`, async (ctx)=>{
        if(ctx.res.status === 2) {
            const {text, keyboard} = await models.getAllFormsForToday(ctx.res.zavod);
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.hears(`📅 Заявки на завтра`, async (ctx)=>{
        if(ctx.res.status === 2) {
            const {text, keyboard} = await models.getAllFormsForNextDay(ctx.res.zavod);
            return ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.hears(`🚚 Мои машины`, async (ctx)=>{
        if(ctx.res.status === 2) {
            return ctx.replyWithHTML(`🚚 Мои машины`, {reply_markup: {inline_keyboard: [[{text: 'Поиск ТТН по заявке', callback_data: 'get_ttn_by_form'}],[{text: 'Добавить наемного водителя', callback_data: 'add_livery_driver'}]]}})
        }
    })

    bot.action(`get_ttn_by_form`, async (ctx)=>{
        ctx.answerCbQuery();
        ctx.scene.enter(`get_ttn_by_form`)
    })

    bot.hears(`🚛 Самовывоз`, async (ctx)=>{
        if(ctx.res.status === 2) {
            return ctx.replyWithHTML(`🚛 Самовывоз`, {reply_markup: {inline_keyboard: [[{text: 'Создать заявку на самовывоз', callback_data: 'create_pickup_form'}], [{text: 'Входящий самовывоз', callback_data: 'incoming_pickups'}], [{text: 'Список подтвержденных', callback_data: 'confirmed_pickups'}]]}})
        }
    })

    bot.action(`incoming_pickups`, async (ctx)=>{
        if(ctx.res.status === 2) {
            let {text, keyboard} = await models.getIncomingPickups(ctx.res.zavod);
            keyboard.push([{text: 'Вернуться', callback_data: 'main_pickups'}])
            return ctx.editMessageText(text, {parse_mode: 'HTML',reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.action(`confirmed_pickups`, async (ctx)=>{
        if(ctx.res.status === 2) {
            let {text, keyboard} = await models.getConfirmedPickups(ctx.res.zavod);
            keyboard.push([{text: 'Вернуться', callback_data: 'main_pickups'}])
            return ctx.editMessageText(text, {parse_mode: 'HTML',reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.action(/finish_pickup_by_logist:(\d+)/, async (ctx)=>{
        await models.finishPickup(parseInt(ctx.match[1]), ctx.res.zavod);

        ctx.editMessageText(`<b>Заявка завершена!</b>`, {parse_mode: 'HTML'});
        const form = await db.getForm(parseInt(ctx.match[1]))
        ctx.telegram.sendMessage(form.logist_id,`Завод ${await db.getZavodName(ctx.res.zavod)} завершил самовывоз к заявке #${form.fid}.`)

        const user = await db.getUser(ctx.from.id);
        if(user.zavod > -1){
            const zavod = await db.getZavod(user.zavod);
            if(zavod && zavod.group !== -1 && zavod.group !== null){
                ctx.telegram.sendMessage(zavod.group, `<b>${status[user.status]} ${user.real_name || `Неизвестное имя`} (TG: ${ctx.from.first_name} @${ctx.from.username})

Действие:</b> подтвердил самовывоз #${form.fid} ${form.date}  ${form.betonAmount} м³ ${form.betonType} ${await db.getZavodName(form.logist_id)}`, {parse_mode:'HTML'})
            }
        }
    })

    bot.action(`main_pickups`, async (ctx)=>{
        if(ctx.res.status === 2) {
            return ctx.editMessageText(`🚛 Самовывоз`, {reply_markup: {inline_keyboard: [[{text: 'Создать заявку на самовывоз', callback_data: 'create_pickup_form'}], [{text: 'Входящий самовывоз', callback_data: 'incoming_pickups'}], [{text: 'Список подтвержденных', callback_data: 'confirmed_pickups'}]]}})
        }
    })

    bot.action(`create_pickup_form`, async (ctx)=>{
        if(ctx.res.status === 2) {
            ctx.deleteMessage();
            ctx.scene.enter(`create_pickup_form`)
        }
    })

    bot.action(/acceptpickupform:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            const accept = await models.acceptPickupForm(ctx.res.zavod, parseInt(ctx.match[1]))
            if(accept){
                const form = await db.getForm(parseInt(ctx.match[1]))
                ctx.editMessageText(`<b>Заявка подтверждена!</b>`, {parse_mode: 'HTML'});
                ctx.telegram.sendMessage(form.logist_id,`Завод ${await db.getZavodName(ctx.res.zavod)} принял ваше предложение о самовывозе к заявке #${form.fid}.`)
            }
            else{
                ctx.editMessageText(`<b>Заявка уже принята!</b>`, {parse_mode: 'HTML'});
            }
        }
    })

    bot.action(/cancelpickupform:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            const cancel = await models.cancelPickupForm(parseInt(ctx.match[1]))
            if(cancel){
                const form = await db.getForm(parseInt(ctx.match[1]))
                ctx.editMessageText(`<b>Заявка отказана!</b>`, {parse_mode: 'HTML'});
                ctx.telegram.sendMessage(form.logist_id,`Завод ${await db.getZavodName(ctx.res.zavod)} отклонил ваше предложение о самовывозе к заявке #${form.fid}.`)
            }
        }
    })

    bot.action(/form_shipment:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            ctx.editMessageText(`<b>Выберите завод для доставки</b>`, {parse_mode: 'HTML', reply_markup: {inline_keyboard: [[{text: 'Все заводы', callback_data: `all_zavods_pickup:${ctx.match[1]}`}], [{text: 'Выбрать завод', callback_data: `select_zavod_pickup:${ctx.match[1]}`}], [{text: 'Вернуться', callback_data: `logist_form:${ctx.match[1]}`}]]}})
        }
    })

    bot.action(/all_zavods_pickup:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            await db.updateForm(ctx.match[1], 'Pickup', -1)
            ctx.editMessageText(`<b>Заявка успешно перенесена на все заводы, ожидайте уведомления</b>`, {parse_mode: 'HTML'})
        }
    })

    bot.action(/select_zavod_pickup:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            let {text, keyboard} = await models.getAllZavods(parseInt(ctx.match[1]));
            keyboard.push([{text: 'Вернуться', callback_data: `form_shipment:${ctx.match[1]}`}])
            ctx.editMessageText(text, {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard}})
        }
    })

    bot.action(/select_zavod_pickups:(\d+):(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            await db.updateForm(ctx.match[1], 'Pickup', ctx.match[2])
            ctx.editMessageText(`<b>Заявка успешно перенесена на завод ${await db.getZavod(ctx.match[2]).name}, ожидайте уведомления</b>`, {parse_mode: 'HTML'})
        }
    })

    bot.action(`add_livery_driver`, async (ctx)=>{
        const hash = await models.createLiveryDriverLink(ctx.from.id);

        ctx.replyWithHTML(`<b>Создана новая реферальная ссылка для наемного водителя

Ссылка:</b> <a href="t.me/${ctx.botInfo.username}?start=${hash}">*СКОПИРУЙТЕ*</a>

<i>ССЫЛКА ОДНОРАЗОВАЯ</i>`)
    })

    bot.action(/logist_form:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            index.openAncet(ctx,ctx.match[1], 0)
        }
    })

    bot.action(/send_to_carriers:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            const form = await db.getForm(ctx.match[1])
            if(form.to_carrier === -2){
                await db.updateForm(ctx.match[1], 'to_carrier', -1)
                ctx.editMessageText(`<b>Заявка успешно отправлена перевозчикам</b>`, {parse_mode: 'HTML'})
            }
            else{
                return ctx.editMessageText(`<b>Заявка уже отправлена перевозчикам</b>`, {parse_mode: 'HTML'})
            }
        }
    })

    bot.action(/booking_own_car:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            ctx.deleteMessage();
            db.bindLogist(parseInt(ctx.match[1]), ctx.from.id);
            ctx.scene.enter('booking_own_car', {fid: parseInt(ctx.match[1])})
        }
    })
    bot.action(/accept_condition:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            const condition = await db.getCondition(ctx.match[1])
            const form = await db.getForm(condition.form_id)
            const carrier_user = await db.getUser(condition.created_by)
            if(form.to_carrier === -1){
                await db.updateForm(condition.form_id, 'to_carrier', carrier_user.zavod)
                await db.updateForm(condition.form_id, condition.edit, condition.newvalue)
            }
            else if(form.to_carrier === carrier_user.zavod){
                await db.updateForm(condition.form_id, condition.edit, condition.newvalue)
            }
            else{
                return ctx.editMessageText(`<b>Условие не принято, так как заявка уже забронирована другому перевозчику</b>`, {parse_mode: 'HTML'})
            }

            ctx.editMessageText(`<b>Условие успешно принято!</b>`, {parse_mode: 'HTML'})
            ctx.telegram.sendMessage(condition.created_by, `<b>Ваше условие для заявки #${condition.form_id} принято</b>`, {parse_mode: 'HTML'})
        }
    })
    bot.action(/reject_condition:(\d+)/, async (ctx)=>{
        if(ctx.res.status === 2) {
            const condition = await db.getCondition(ctx.match[1])
            ctx.editMessageText(`<b>Условие успешно отклонено!</b>`, {parse_mode: 'HTML'})
            ctx.telegram.sendMessage(condition.created_by, `<b>Ваше условие для заявки #${condition.form_id} отклонено</b>`, {parse_mode: 'HTML'})
        }
    })
};
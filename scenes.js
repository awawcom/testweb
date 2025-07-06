const { Scenes, Markup} = require('telegraf');
const db = require('./database');
const { query, getUser, createForm} = require('./database');
const {mainMenu, betonType, status, payForms, editTypes, ancetaStatus} = require('./data');
const Calendar = require('telegraf-calendar-telegram');
const XLSX = require('xlsx');
const fs = require('fs');
function formatPhoneNumber(input) {
    const cleaned = input.replace(/\D/g, '');

    if (cleaned.length === 11 && (cleaned.startsWith('7') || cleaned.startsWith('8'))) {
        return `+7${cleaned.slice(1)}`;
    } else if (cleaned.length === 10 && cleaned.startsWith('9')) {
        return `+7${cleaned}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('7')) {
        return `+${cleaned}`;
    } else {
        return null;
    }
}
require('dotenv').config();
const calendar = new Calendar(process.env.BOT_TOKEN, {
    startWeekDay: 1,
    weekDayNames: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    monthNames: [
        "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
        "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
    ],
    minDate: new Date(),
    maxDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
});
function chunkArray(arr, size) {
    return Array.from({length: Math.ceil(arr.length / size)}, (_, i) =>
        arr.slice(i * size, i * size + size)
    );
}
const index = require(`./index`);

const carrierModels = require('./carrier/models');

module.exports.setupScenes = () => {
    function hasDangerousChars(text) {
        return /[{}[\]\\|`]/.test(text);
    }
    const enter_name= new Scenes.WizardScene(
        'enter_name',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Введите ваше имя:</b>`);
            ctx.wizard.state.messageId2 = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            let name = ctx.message.text;
            if(name.startsWith(`/start`)) return await ctx.replyWithHTML(`❌ <b>Введите имя</b>`);
            if(!hasDangerousChars(name)){
                ctx.deleteMessage()
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                await query(`UPDATE users SET real_name=?, referal=? WHERE id=?`, [name, ctx.wizard.state.ref, ctx.from.id])
                let user = await getUser(ctx.from.id);
                mainMenu(ctx, user.status)
                return ctx.scene.leave();
            }
            else {
                await ctx.reply(`❌`)
                return ctx.scene.leave()
            }
        },
    );
    const search_by_phone= new Scenes.WizardScene(
        'search_by_phone',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Введите номер телефона для поиска заявки:</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId2 = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            let phone = ctx.message.text;
            const form = formatPhoneNumber(phone);
            if(form){
                ctx.deleteMessage()
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                let z = await query(`SELECT * FROM forms WHERE phone=? AND priv=-1 AND (type=0 OR type=1)`, [form]);
                if(z.length > 0){
                    await query(`UPDATE forms SET priv=? WHERE fid=?`, [ctx.from.id,z[0].fid]);
                    await index.userAncets(ctx);
                    await ctx.scene.leave();
                }
                else{
                    await ctx.replyWithHTML(`<b>Заявка не найдена!</b>`);
                    await ctx.scene.leave();
                }
            }
            else {
                await ctx.replyWithHTML(`<b>Неверный номер телефона!</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}})
            }
        },
    );
    const search_by_id= new Scenes.WizardScene(
        'search_by_id',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Введите номер заявки для поиска:</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId2 = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            let fid = Number(ctx.message.text);
            if(fid > 0){
                ctx.deleteMessage()
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                let z = await query(`SELECT * FROM forms WHERE fid=? AND priv=-1 AND (type=0 OR type=1)`, [fid]);
                if(z.length > 0){
                    await query(`UPDATE forms SET priv=? WHERE fid=?`, [ctx.from.id,fid]);
                    await index.userAncets(ctx);
                    await ctx.scene.leave();
                }
                else{
                    await ctx.replyWithHTML(`<b>Заявка не найдена!</b>`);
                    await ctx.scene.leave();
                }
            }
            else {
                await ctx.replyWithHTML(`<b>Неверный номер заявки!</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}})
            }
        },
    );
    const enter_company = new Scenes.WizardScene(
        'enter_company',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Введите название вашей компании</b>`);
            ctx.wizard.state.messageId2 = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            let name = ctx.message.text;
            if(!hasDangerousChars(name)){
                await query(`UPDATE users SET company=? WHERE id=?`, [name, ctx.from.id])
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                ctx.deleteMessage()
                const s = await ctx.replyWithHTML(`<b>Введите ваше имя:</b>`);
                ctx.wizard.state.messageId2 = s.message_id;
                return ctx.wizard.next();
            }
            else {
                await ctx.reply(`❌`)
                return ctx.scene.leave()
            }
        },
        async (ctx) => {
            let name = ctx.message.text;
            if(!hasDangerousChars(name)){
                ctx.deleteMessage()
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                await query(`UPDATE users SET real_name=?, referal=? WHERE id=?`, [name, ctx.wizard.state.ref, ctx.from.id])
                let user = await getUser(ctx.from.id);
                mainMenu(ctx, user.status)
                return ctx.scene.leave();
            }
            else {
                await ctx.reply(`❌`)
                return ctx.scene.leave()
            }
        },
    );
    const create_ancet = new Scenes.WizardScene(
        'create_ancet',
        async (ctx) => {
            const calendarKeyboard = calendar.getCalendar(new Date())
            const cancelButton = Markup.button.callback('❌ Отмена', 'stopscene');
            const s = await ctx.replyWithHTML(`📆 <b>Укажите дату и время когда требуется бетон</b>`, { reply_markup: { inline_keyboard: [
                        ...calendarKeyboard.reply_markup.inline_keyboard,
                        [cancelButton]
                    ]
                }});
            ctx.wizard.state.messageId = s.message_id;
            const now = new Date();
            ctx.wizard.state.calendarMessageId = s.message_id;
            ctx.wizard.state.currentMonth = now.getMonth();
            ctx.wizard.state.currentYear = now.getFullYear();
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }

                if (ctx.callbackQuery.data.startsWith('calendar-telegram-prev')) {
                    const { currentMonth, currentYear } = ctx.wizard.state;
                    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

                    ctx.wizard.state.currentMonth = prevMonth;
                    ctx.wizard.state.currentYear = prevYear;

                    const newDate = new Date(prevYear, prevMonth, 1);
                    const newCalendar = calendar.getCalendar(newDate);

                    await ctx.editMessageReplyMarkup({
                        inline_keyboard: [
                            ...newCalendar.reply_markup.inline_keyboard,
                            [Markup.button.callback('❌ Отмена', 'stopscene')]
                        ]
                    });
                    return;
                }

                if (ctx.callbackQuery.data.startsWith('calendar-telegram-next')) {
                    const { currentMonth, currentYear } = ctx.wizard.state;
                    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
                    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

                    ctx.wizard.state.currentMonth = nextMonth;
                    ctx.wizard.state.currentYear = nextYear;

                    const newDate = new Date(nextYear, nextMonth, 1);
                    const newCalendar = calendar.getCalendar(newDate);

                    await ctx.editMessageReplyMarkup({
                        inline_keyboard: [
                            ...newCalendar.reply_markup.inline_keyboard,
                            [Markup.button.callback('❌ Отмена', 'stopscene')]
                        ]
                    });
                    return;
                }

                else if (ctx.callbackQuery.data.startsWith('calendar-telegram-ignore')) {
                    return ctx.answerCbQuery();
                }
                else if (ctx.callbackQuery.data.startsWith('calendar-telegram')) {
                    const dateStr = ctx.callbackQuery.data.replace('calendar-telegram-date-', '');
                    const [year, month, day] = dateStr.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.date = date.toLocaleDateString('ru-RU');


                    const timeKeyboard = Markup.inlineKeyboard([
                        [
                            Markup.button.callback('🌅 Утро (8:00-11:00)', 'interval_8_11'),
                            Markup.button.callback('🌇 День (13:00-16:00)', 'interval_13_16')
                        ],
                        [Markup.button.callback('⏱ Выбрать вручную', 'manual_time')],
                        [Markup.button.callback('❌ Отмена', 'stopscene')]
                    ]);


                    const s = await ctx.replyWithHTML(`⏰ <b>Выберите интервал доставки (от 7:00 до 18:00):</b>`,
                        timeKeyboard);
                    ctx.wizard.state.messageId = s.message_id;
                    ctx.wizard.state.timeSelectionStage = 'start';
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }

                if (ctx.callbackQuery.data.startsWith('interval_')) {
                    const [start, end] = ctx.callbackQuery.data.replace('interval_', '').split('_').map(Number);
                    ctx.wizard.state.timeInterval = `${start}:00 - ${end}:00`;
                    ctx.wizard.state.startHour = start;
                    ctx.wizard.state.endHour = end;

                    await ctx.deleteMessage(ctx.wizard.state.messageId);

                    const betonBut = betonType.map(b =>
                        [{text: `${b}`, callback_data:`type_${b}`}]
                    );
                    betonBut.push([{ text: '❌ Отмена', callback_data: 'stopscene' }])
                    const s = await ctx.replyWithHTML(
                        `📅 <b>Дата доставки:</b> ${ctx.wizard.state.date}\n` +
                        `⏰ <b>Время:</b> ${ctx.wizard.state.timeInterval}\n\n` +
                        `📦 <b>Укажите марку бетона:</b>`,
                        {
                            reply_markup: {
                                inline_keyboard: betonBut
                            }
                        }
                    );

                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }

                if (ctx.callbackQuery.data === 'manual_time') {
                    const hours = Array.from({length: 12}, (_, i) => i + 7);
                    const timeButtons = hours.map(h =>
                        Markup.button.callback(`${h}:00`, `time_${h}`)
                    );

                    await ctx.editMessageText(
                        `⏰ <b>Выберите начальное время (7:00-18:00):</b>`,
                        { parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    ...chunkArray(timeButtons, 4),
                                    [
                                        Markup.button.callback('◀️ Назад', 'time_back'),
                                        Markup.button.callback('❌ Отмена', 'stopscene')
                                    ]
                                ]
                            }
                        }
                    );

                    ctx.wizard.state.timeSelectionStage = 'start';
                    return;
                }

                if (ctx.callbackQuery.data.startsWith('time_')) {
                    const selectedHour = parseInt(ctx.callbackQuery.data.replace('time_', ''));

                    if (ctx.wizard.state.timeSelectionStage === 'start') {
                        ctx.wizard.state.startHour = selectedHour;
                        ctx.wizard.state.timeSelectionStage = 'end';

                        const minEnd = selectedHour + 1;
                        const maxEnd = Math.min(selectedHour + 3, 18);
                        const endHours = Array.from({length: maxEnd - minEnd + 1}, (_, i) => minEnd + i);

                        const endButtons = endHours.map(h =>
                            Markup.button.callback(`${h}:00`, `time_${h}`)
                        );

                        await ctx.editMessageText(
                            `⏰ Вы выбрали начало в ${selectedHour}:00\n` +
                            `<b>Выберите конечное время (до ${maxEnd}:00):</b>`,
                            { parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: [
                                        ...chunkArray(endButtons, 3),
                                        [
                                            Markup.button.callback('◀️ Назад', 'time_back'),
                                            Markup.button.callback('❌ Отмена', 'stopscene')
                                        ]
                                    ]
                                }
                            }
                        );
                    } else if (ctx.wizard.state.timeSelectionStage === 'end') {
                        const startHour = ctx.wizard.state.startHour;
                        const endHour = selectedHour;

                        if (endHour <= startHour || endHour > startHour + 3) {
                            await ctx.answerCbQuery('❌ Интервал должен быть от 1 до 3 часов');
                            return;
                        }

                        ctx.wizard.state.endHour = endHour;
                        ctx.wizard.state.timeInterval = `${startHour}:00 - ${endHour}:00`;

                        await ctx.deleteMessage(ctx.wizard.state.messageId);
                        const betonBut = betonType.map(b =>
                            [{text: `${b}`, callback_data:`type_${b}`}]
                        );
                        betonBut.push([{ text: '❌ Отмена', callback_data: 'stopscene' }])
                        const s = await ctx.replyWithHTML(
                            `📅 <b>Дата доставки:</b> ${ctx.wizard.state.date}\n` +
                            `⏰ <b>Временной интервал:</b> ${ctx.wizard.state.timeInterval}\n\n` +
                            `📦 <b>Укажите марку бетона:</b>`,
                            {
                                reply_markup: {
                                    inline_keyboard: betonBut
                                }
                            }
                        );

                        ctx.wizard.state.messageId = s.message_id;
                        return ctx.wizard.next();
                    }
                }

                if (ctx.callbackQuery.data === 'time_back') {
                    const timeKeyboard = Markup.inlineKeyboard([
                        [
                            Markup.button.callback('🌅 Утро (8:00-11:00)', 'interval_8_11'),
                            Markup.button.callback('🌇 День (13:00-16:00)', 'interval_13_16')
                        ],
                        [Markup.button.callback('⏱ Выбрать вручную', 'manual_time')],
                        [Markup.button.callback('❌ Отмена', 'stopscene')]
                    ]);

                    await ctx.editMessageText(
                        `⏰ <b>Выберите временной интервал доставки:</b>`,
                        {parse_mode: 'HTML',
                        ...timeKeyboard}
                    );

                    delete ctx.wizard.state.timeSelectionStage;
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`type_`)){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.betonType = ctx.callbackQuery.data.split('_')[1];
                    const s = await ctx.replyWithHTML(`⚖️ <b>Укажите объем бетона который вам нужен (в кубических метрах)</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage()
            ctx.wizard.state.amount = ctx.message.text;
            const s = await ctx.replyWithHTML(`📍 <b>Укажите населенный пункт поставки, если это город, напишите улицу куда требуется бетон</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage()
            ctx.wizard.state.place = ctx.message.text;
            const s = await ctx.replyWithHTML(`📍 <b>Выберите допы к заявке</b>`, {reply_markup: {inline_keyboard: [[{text: 'Автобетононасос', callback_data: 'selectdop:Автобетононасос'}],[{text: 'Труба 6м', callback_data: 'selectdop:Труба 6м'}],[{text: 'Не требуется', callback_data: 'dop'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `dop`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.dop = 'Не требуется';
                    const s = await ctx.replyWithHTML(`📷 <b>Для наиболее грамотной поставки бетона пришлите фото подъездных путей, так логисты смогут подобрать наиболее подходящий вариант для вашего объекта</b>`, {reply_markup: {inline_keyboard: [[{text: 'Продолжить без фото', callback_data: 'noPhoto'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
                else if(ctx.callbackQuery.data.startsWith(`selectdop:`)){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.dop = ctx.callbackQuery.data.split(':')[1];
                    const s = await ctx.replyWithHTML(`📷 <b>Для наиболее грамотной поставки бетона пришлите фото/видео подъездных путей, так логисты смогут подобрать наиболее подходящий вариант для вашего объекта</b>`, {reply_markup: {inline_keyboard: [[{text: 'Продолжить без фото', callback_data: 'noPhoto'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `noPhoto`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.photos = null;
                    ctx.wizard.state.video = null;
                    const s = await ctx.replyWithHTML(`✏️ <b>Введите комментарий к заявке (Пример: форма одежды, требуется ли интервал между машинами, пожелания по доставке)</b>`, {reply_markup: {inline_keyboard: [[{text: 'Продолжить без комментария', callback_data: 'nocom'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
                else if(ctx.callbackQuery.data === `stop`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    const s = await ctx.replyWithHTML(`✏️ <b>Введите комментарий к заявке (Пример: форма одежды, требуется ли интервал между машинами, пожелания по доставке)</b>`, {reply_markup: {inline_keyboard: [[{text: 'Продолжить без комментария', callback_data: 'nocom'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
            if(ctx.message.photo){
                if(!ctx.wizard.state.photo) ctx.wizard.state.photo = [];
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                ctx.wizard.state.photo.push(ctx.message.photo[ctx.message.photo.length - 1].file_id);
                const s = await ctx.replyWithHTML(`📷 <b>Добавлено фото!</b>`, {reply_markup: {inline_keyboard: [[{text: 'Закончить', callback_data: 'stop'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
            }
            else if(ctx.message.video){
                if(!ctx.wizard.state.video) ctx.wizard.state.video = [];
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                ctx.wizard.state.video.push(ctx.message.video.file_id);
                const s = await ctx.replyWithHTML(`📷 <b>Добавлено видео!</b>`, {reply_markup: {inline_keyboard: [[{text: 'Закончить', callback_data: 'stop'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
            }
            else{
                return ctx.replyWithHTML(`❌ <b>Требуется прислать фото/видео!</b>`)
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `nocom`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.com = 'Без комментария';
                    const s = await ctx.replyWithHTML(`<b>📞 Введите ваш контактный номер телефона:</b>
<i>(Ваш контактный телефон никто не видит пока вы не выберете поставщика бетона
Только после подтверждения вами заявки телефон появляется у менеджера для связи с вами)</i>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage()
            ctx.wizard.state.com = ctx.message.text;
            const s = await ctx.replyWithHTML(`<b>📞 Введите ваш контактный номер телефона:</b>
<i>(Ваш контактный телефон никто не видит пока вы не выберете поставщика бетона
Только после подтверждения вами заявки телефон появляется у менеджера для связи с вами)</i>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            const form = formatPhoneNumber(ctx.message.text)

            if(form){
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                ctx.wizard.state.phone = form;
                let but = [];
                const user = await getUser(ctx.from.id);
                if(user.referal !== -1 && user.referal !== null){
                    const zavod = (await query(`SELECT * FROM zavod WHERE fid=?`, [user.referal]))[0];
                    but.push([{text: `Отправить на ${zavod.name}`, callback_data: `sendto:${zavod.fid}`}])
                }
                but.push([{text: 'Отправить всем заводам', callback_data: 'sendto:-1'}],[{text: 'Отправить определенному заводу', callback_data: 'sendz'}],[{text: '❌ Отмена', callback_data: 'stopscene'}])
                const s = await ctx.replyWithHTML(`<b>📋 Заявка составлена!
1. Дата и время:</b> ${ctx.wizard.state.date} ${ctx.wizard.state.timeInterval}
<b>2. Марка и обьем:</b> ${ctx.wizard.state.betonType} | ${ctx.wizard.state.amount} м³
<b>3. Адрес:</b> ${ctx.wizard.state.place}
<b>4. Допы:</b> ${ctx.wizard.state.dop}
<b>5. Комментарий:</b> ${ctx.wizard.state.com}
<b>6. Номер телефона:</b> ${ctx.wizard.state.phone}

<i>Отправьте эту заявку всем заводам чтобы получить наилучшее предложение или отправьте этот запрос на конкретный завод</i>`, {reply_markup: {inline_keyboard: but}});
                ctx.wizard.state.messageId = s.message_id;
                return ctx.wizard.next();
            }
            else{
                await ctx.replyWithHTML('<b>❌ Неверный формат номера. Введите заново ваш контактный номер телефона</b>');
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `sendz`){
                    const all = await query(`SELECT * FROM zavod WHERE type=0`);
                    let but = all.map(s=>[{text: `• ${s.name}`, callback_data: 'ignore'}, {text: 'О заводе', callback_data: `getz:${s.fid}`}]);
                    but.push([{text: 'Вернуться', callback_data: 'toancet'}]);
                    ctx.editMessageText(`📨 <b>Отправить запрос на конкретный завод</b>`, {parse_mode: 'HTML', reply_markup: {inline_keyboard: but}})
                }
                else if(ctx.callbackQuery.data === `ignore`){
                    ctx.answerCbQuery();
                }
                else if(ctx.callbackQuery.data === `toancet`){
                    let but = [];
                    const user = await getUser(ctx.from.id);
                    if(user.referal !== -1 && user.referal !== null){
                        const zavod = (await query(`SELECT * FROM zavod WHERE fid=?`, [user.referal]))[0];
                        but.push([{text: `Отправить на ${zavod.name}`, callback_data: `sendto:${zavod.fid}`}])
                    }
                    but.push([{text: 'Отправить всем заводам', callback_data: 'sendto:-1'}],[{text: 'Отправить определенному заводу', callback_data: 'sendz'}],[{text: '❌ Отмена', callback_data: 'stopscene'}])
                    await ctx.editMessageText(`<b>📋 Заявка составлена!
1. Дата и время:</b> ${ctx.wizard.state.date} ${ctx.wizard.state.timeInterval}
<b>2. Марка и обьем:</b> ${ctx.wizard.state.betonType} | ${ctx.wizard.state.amount} м³
<b>3. Адрес:</b> ${ctx.wizard.state.place}
<b>4. Допы:</b> ${ctx.wizard.state.dop}
<b>5. Комментарий:</b> ${ctx.wizard.state.com}
<b>6. Номер телефона:</b> ${ctx.wizard.state.phone}

<i>Отправьте эту заявку всем заводам чтобы получить наилучшее предложение или отправьте этот запрос на конкретный завод</i>`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: [[{text: 'Отправить всем заводам', callback_data: 'sendto:-1'}],[{text: 'Отправить определенному заводу', callback_data: 'sendz'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                }
                else if(ctx.callbackQuery.data.startsWith(`getz:`)){
                    ctx.answerCbQuery();
                    const id = ctx.callbackQuery.data.split(':')[1];
                    const z = (await query(`SELECT * FROM zavod WHERE fid=${id}`))[0];
                    if(z){
                        await ctx.editMessageText(`<b>🏭 Производитель:</b> <i>${z.name}</i>

<b>Адрес:</b> <i>${z.place}</i>
<b>Описание:</b> <i>${z.discription}</i>`, {parse_mode: 'HTML',reply_markup: {inline_keyboard: [[{text: 'Отправить на данный завод', callback_data: `sendto:${id}`}],[{text: 'Вернуться', callback_data: 'sendz'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    }
                }
                else if(ctx.callbackQuery.data.startsWith(`sendto:`)){
                    ctx.deleteMessage();
                    ctx.scene.leave();
                    const {date, timeInterval, betonType, amount, place, dop, com, phone} = ctx.wizard.state
                    let media = [];
                    let ph = [];
                    let vd = [];
                    if(ctx.wizard.state.photo !== undefined && ctx.wizard.state.photo?.length > 0){
                        ph = ctx.wizard.state.photo.map((fileId) => {
                            return {type: 'photo', fileId: fileId}});
                    }
                    if(ctx.wizard.state.video !== undefined && ctx.wizard.state.video?.length > 0){
                        vd = ctx.wizard.state.video.map((fileId) => {return {type: 'video', fileId: fileId}});
                    }
                    media = JSON.stringify(media.concat(ph,vd));
                    const res = await createForm({
                        type: 0,
                        created_by: ctx.from.id,
                        date: `${date} ${timeInterval}`,
                        place: place,
                        phone: phone,
                        betonType: betonType,
                        betonAmount: amount,
                        dopAll: dop,
                        com: com,
                        media: media,
                        zavod: Number(ctx.callbackQuery.data.split(':')[1]),
                        status: 0
                    })
                    if(res){
                        await ctx.replyWithHTML(`🗂 <b>Ваша заявка успешно создана! Ожидайте уведомлений.</b>

<i>Чтобы посмотреть статус заявки, нажмите на "❗️ У МЕНЯ УЖЕ ЕСТЬ ЗАЯВКА"</i>`)

                        const id = parseInt(ctx.callbackQuery.data.split(':')[1]);
                        let allManagers;
                        if(id !== -1){
                            allManagers = await query(`SELECT * FROM users WHERE status=1 AND zavod=?`, [id])
                        }
                        else{
                            allManagers = await query(`SELECT * FROM users WHERE status=1`)
                        }
                        for(const manager of allManagers){
                            await ctx.telegram.sendMessage(manager.id, `📨 <b>Пришла новая заявка на обработку!</b>`, {parse_mode: 'HTML', reply_markup: {inline_keyboard: [[{text: 'Посмотреть', callback_data: `getanc:${res}`}]]}})
                        }
                    }
                }
            }
        },
    );
    const load_nc = new Scenes.WizardScene(
        'load_nc',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Пришлите файл таблицы (формат: .xlsx, .xls, .csv).</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId2 = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            if(ctx.message.document){
                const user = await getUser(ctx.from.id);
                if(user?.status === 5){
                    const fileId = ctx.message.document.file_id;
                    const fileLink = await ctx.telegram.getFileLink(fileId);
                    const fileResponse = await fetch(fileLink);
                    const fileBuffer = await fileResponse.arrayBuffer();

                    try {
                        ctx.deleteMessage();
                        ctx.deleteMessage(ctx.wizard.state.messageId2);

                        const workbook = XLSX.read(fileBuffer);
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet);

                        const formattedData = jsonData.map((row) => ({
                            id: row['Идентификатор'] || -1,
                            rod_id: row['Родительский идентификатор'] || -1,
                            name: row['Наименование'] || '',
                            price_per_unit: row['цена за ед.'] || -1,
                            unit_of_measurement: row['ед. измерения'] || '',
                            key: row['ключ назначения'] || '',
                            multiplicity: row['кратность'] || -1,
                        }));
                        await query(`DELETE FROM nc WHERE zavod=${user.zavod}`);
                        let all = 0;
                        let t = 0;
                        let f = 0
                        for (const row of formattedData) {
                            if(row.id !== -1){
                                all += 1;
                                try {
                                    await query(`INSERT INTO nc (id, rod_id, name, price_per_unit, unit_of_measurement, \`key\`, multiplicity, zavod) VALUES (?,?,?,?,?,?,?,?)`, [row.id,row.rod_id,row.name,row.price_per_unit, row.unit_of_measurement, row.key, row.multiplicity, user.zavod])
                                    t += 1
                                }
                                catch (e) {
                                    f += 1;
                                    console.log(e);
                                }
                            }
                        }
                        await ctx.replyWithHTML(`<b>Номенклатура успешно загружена!</b>
                        
<b>Всего столбцов:</b> ${all}
<b>Удачно:</b> ${t}
<b>Неудачно:</b> ${f}`)
                        return ctx.scene.leave();
                    } catch (error) {
                        console.error(error);
                        await ctx.replyWithHTML('<b>Произошла ошибка при обработке файла. Убедитесь, что это Excel-таблица.</b>');
                        return ctx.scene.leave();
                    }
                }
            }
        }
    );

    const worker_registration = new Scenes.WizardScene(
        'worker_registration',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Введите ваше имя</b>`);
            ctx.wizard.state.messageId2 = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            let name = ctx.message.text;
            if(!hasDangerousChars(name)){
                await query(`UPDATE users SET real_name=? WHERE id=?`, [name, ctx.from.id])
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                ctx.deleteMessage()
                const s = await ctx.replyWithHTML(`<b>Введите ваш номер телефона:</b>`);
                ctx.wizard.state.messageId2 = s.message_id;
                return ctx.wizard.next();
            }
            else {
                await ctx.reply(`❌`)
                return ctx.scene.leave()
            }
        },
        async (ctx) => {
            let phone = formatPhoneNumber(ctx.message.text);
            if(phone){
                ctx.deleteMessage()
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                await query(`UPDATE users SET phone=? WHERE id=?`, [phone, ctx.from.id])
                let user = await getUser(ctx.from.id);
                mainMenu(ctx, user.status)
                let u = ctx.from;
                ctx.telegram.sendMessage(ctx.wizard.state.from, `📋 <b>Пользователь <a href="tg://user?id=${u.id}">${u.first_name}</a> (@${u.username || 'Без тега'}), перешел по вашей реферальной ссылке и получил должность: ${status[user.status]}</b>`, {parse_mode: 'HTML'})
                return ctx.scene.leave();
            }
            else {
                await ctx.reply(`❌`)
            }
        },
    );

    const driver_registration = new Scenes.WizardScene(
        'driver_registration',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Введите название компании</b>`);
            ctx.wizard.state.messageId2 = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            let name = ctx.message.text;
            if(!hasDangerousChars(name)){
                ctx.wizard.state.company_name = name;
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                ctx.deleteMessage()
                const s = await ctx.replyWithHTML(`<b>Запишите госномер по примеру А111МР97ШАК12 "ГОСНОМЕР+МАРКА+СКОЛЬКИ КУБОВАЯ"</b>`);
                ctx.wizard.state.messageId2 = s.message_id;
                return ctx.wizard.next();
            }
            else {
                await ctx.reply(`❌`)
                return ctx.scene.leave()
            }
        },
        async (ctx) => {
            let name = ctx.message.text;
            if(!hasDangerousChars(name)){
                ctx.deleteMessage()
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                ctx.wizard.state.car = name;
                ctx.deleteMessage()
                const s = await ctx.replyWithHTML(`<b>Как к вам можно обращаться? (Введите ФИО)</b>`);
                ctx.wizard.state.messageId2 = s.message_id;
                return ctx.wizard.next();
            }
            else {
                await ctx.reply(`❌`)
            }
        },
        async (ctx) => {
            let name = ctx.message.text;
            if(!hasDangerousChars(name)){
                ctx.deleteMessage()
                ctx.deleteMessage(ctx.wizard.state.messageId2);
                ctx.scene.leave();
                ctx.wizard.state.name = name;

                await db.updateUser(ctx.from.id, `real_name`, name);
                const zavod = await db.createZavod(ctx.from.id, ctx.wizard.state.company_name, 1);

                if(!zavod) return;
                
                await db.createCarrierCar(ctx.wizard.state.car, zavod, ctx.from.id);

                let user = await getUser(ctx.from.id);
                mainMenu(ctx, user.status)
                let u = ctx.from;
                ctx.telegram.sendMessage(ctx.wizard.state.from, `📋 <b>Пользователь <a href="tg://user?id=${u.id}">${u.first_name}</a> (@${u.username || 'Без тега'}), перешел по вашей реферальной ссылке и получил должность наемного водителя</b>`, {parse_mode: 'HTML'})
            }
            else {
                await ctx.reply(`❌`)
            }
        },
    );

    const add_car = new Scenes.WizardScene(
        'add_car',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Введите новую машину в формате: Х111ХХ52шак10 (гос. номер + марка машины сокращенно + кол-во кубов)</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId2 = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            let form = ctx.message.text;
            if(!hasDangerousChars(form)){
                const user = await getUser(ctx.from.id);
                if(user && user.status === 5){
                    await query(`INSERT INTO cars (name, zavod) VALUES (?,?)`, [form, user.zavod])
                    ctx.deleteMessage(ctx.wizard.state.messageId2);
                    ctx.deleteMessage()
                    ctx.res = user
                    await index.allCars(ctx);
                    return ctx.scene.leave();
                }
                else{
                    await ctx.reply(`❌`)
                    return ctx.scene.leave()
                }
            }
            else {
                await ctx.reply(`❌`)
                return ctx.scene.leave()
            }
        }
    );

    const add_car_carrier = new Scenes.WizardScene(
        'add_car_carrier',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Введите новую машину в формате: Х111ХХ52шак10 (гос. номер + марка машины сокращенно + кол-во кубов)</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId2 = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }

            let form = ctx.message.text;
            if(!hasDangerousChars(form)){
                const user = await getUser(ctx.from.id);
                if(user && user.status === 6){
                    await db.createCarrierCar(form, user.zavod);
                    ctx.deleteMessage(ctx.wizard.state.messageId2);
                    ctx.deleteMessage()
                    ctx.res = user
                    const {text, keyboard} = await carrierModels.getCars(ctx.res.zavod);
                    await ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: keyboard}})
                    return ctx.scene.leave();
                }
                else{
                    await ctx.reply(`❌`)
                    return ctx.scene.leave()
                }
            }
            else {
                await ctx.reply(`❌`)
                return ctx.scene.leave()
            }
        }
    );

    const manager_create = new Scenes.WizardScene(
        'manager_create',
        async (ctx) => {
            const calendarKeyboard = calendar.getCalendar(new Date())
            const cancelButton = Markup.button.callback('❌ Отмена', 'stopscene');
            const s = await ctx.replyWithHTML(`📆 <b>Укажите дату и время когда требуется бетон</b>`, { reply_markup: { inline_keyboard: [
                        ...calendarKeyboard.reply_markup.inline_keyboard,
                        [cancelButton]
                    ]
                }});
            ctx.wizard.state.messageId = s.message_id;
            const now = new Date();
            ctx.wizard.state.calendarMessageId = s.message_id;
            ctx.wizard.state.currentMonth = now.getMonth();
            ctx.wizard.state.currentYear = now.getFullYear();
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }

                if (ctx.callbackQuery.data.startsWith('calendar-telegram-prev')) {
                    const { currentMonth, currentYear } = ctx.wizard.state;
                    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

                    ctx.wizard.state.currentMonth = prevMonth;
                    ctx.wizard.state.currentYear = prevYear;

                    const newDate = new Date(prevYear, prevMonth, 1);
                    const newCalendar = calendar.getCalendar(newDate);

                    await ctx.editMessageReplyMarkup({
                        inline_keyboard: [
                            ...newCalendar.reply_markup.inline_keyboard,
                            [Markup.button.callback('❌ Отмена', 'stopscene')]
                        ]
                    });
                    return;
                }

                if (ctx.callbackQuery.data.startsWith('calendar-telegram-next')) {
                    const { currentMonth, currentYear } = ctx.wizard.state;
                    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
                    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

                    ctx.wizard.state.currentMonth = nextMonth;
                    ctx.wizard.state.currentYear = nextYear;

                    const newDate = new Date(nextYear, nextMonth, 1);
                    const newCalendar = calendar.getCalendar(newDate);

                    await ctx.editMessageReplyMarkup({
                        inline_keyboard: [
                            ...newCalendar.reply_markup.inline_keyboard,
                            [Markup.button.callback('❌ Отмена', 'stopscene')]
                        ]
                    });
                    return;
                }

                else if (ctx.callbackQuery.data.startsWith('calendar-telegram-ignore')) {
                    return ctx.answerCbQuery();
                }
                else if (ctx.callbackQuery.data.startsWith('calendar-telegram')) {
                    const dateStr = ctx.callbackQuery.data.replace('calendar-telegram-date-', '');
                    const [year, month, day] = dateStr.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.date = date.toLocaleDateString('ru-RU');


                    const timeKeyboard = Markup.inlineKeyboard([
                        [
                            Markup.button.callback('🌅 Утро (8:00-11:00)', 'interval_8_11'),
                            Markup.button.callback('🌇 День (13:00-16:00)', 'interval_13_16')
                        ],
                        [Markup.button.callback('⏱ Выбрать вручную', 'manual_time')],
                        [Markup.button.callback('❌ Отмена', 'stopscene')]
                    ]);


                    const s = await ctx.replyWithHTML(`⏰ <b>Выберите интервал доставки (от 7:00 до 18:00):</b>`,
                        timeKeyboard);
                    ctx.wizard.state.messageId = s.message_id;
                    ctx.wizard.state.timeSelectionStage = 'start';
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }

                if (ctx.callbackQuery.data.startsWith('interval_')) {
                    const [start, end] = ctx.callbackQuery.data.replace('interval_', '').split('_').map(Number);
                    ctx.wizard.state.timeInterval = `${start}:00 - ${end}:00`;
                    ctx.wizard.state.startHour = start;
                    ctx.wizard.state.endHour = end;

                    await ctx.deleteMessage(ctx.wizard.state.messageId);

                    const s = await ctx.replyWithHTML(
                        `📅 <b>Дата доставки:</b> ${ctx.wizard.state.date}\n` +
                        `⏰ <b>Время:</b> ${ctx.wizard.state.timeInterval}\n\n` +
                        `📦 <b>Укажите адрес для доставки:</b>`,
                        {
                            reply_markup: {
                                inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'stopscene' }]]
                            }
                        }
                    );

                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }

                if (ctx.callbackQuery.data === 'manual_time') {
                    const hours = Array.from({length: 12}, (_, i) => i + 7);
                    const timeButtons = hours.map(h =>
                        Markup.button.callback(`${h}:00`, `time_${h}`)
                    );

                    await ctx.editMessageText(
                        `⏰ <b>Выберите начальное время (7:00-18:00):</b>`,
                        { parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    ...chunkArray(timeButtons, 4),
                                    [
                                        Markup.button.callback('◀️ Назад', 'time_back'),
                                        Markup.button.callback('❌ Отмена', 'stopscene')
                                    ]
                                ]
                            }
                        }
                    );

                    ctx.wizard.state.timeSelectionStage = 'start';
                    return;
                }

                if (ctx.callbackQuery.data.startsWith('time_')) {
                    const selectedHour = parseInt(ctx.callbackQuery.data.replace('time_', ''));

                    if (ctx.wizard.state.timeSelectionStage === 'start') {
                        ctx.wizard.state.startHour = selectedHour;
                        ctx.wizard.state.timeSelectionStage = 'end';

                        const minEnd = selectedHour + 1;
                        const maxEnd = Math.min(selectedHour + 3, 18);
                        const endHours = Array.from({length: maxEnd - minEnd + 1}, (_, i) => minEnd + i);

                        const endButtons = endHours.map(h =>
                            Markup.button.callback(`${h}:00`, `time_${h}`)
                        );

                        await ctx.editMessageText(
                            `⏰ Вы выбрали начало в ${selectedHour}:00\n` +
                            `<b>Выберите конечное время (до ${maxEnd}:00):</b>`,
                            { parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: [
                                        ...chunkArray(endButtons, 3),
                                        [
                                            Markup.button.callback('◀️ Назад', 'time_back'),
                                            Markup.button.callback('❌ Отмена', 'stopscene')
                                        ]
                                    ]
                                }
                            }
                        );
                    } else if (ctx.wizard.state.timeSelectionStage === 'end') {
                        const startHour = ctx.wizard.state.startHour;
                        const endHour = selectedHour;

                        if (endHour <= startHour || endHour > startHour + 3) {
                            await ctx.answerCbQuery('❌ Интервал должен быть от 1 до 3 часов');
                            return;
                        }

                        ctx.wizard.state.endHour = endHour;
                        ctx.wizard.state.timeInterval = `${startHour}:00 - ${endHour}:00`;

                        await ctx.deleteMessage(ctx.wizard.state.messageId);
                        const betonBut = betonType.map(b =>
                            [{text: `${b}`, callback_data:`type_${b}`}]
                        );
                        betonBut.push([{ text: '❌ Отмена', callback_data: 'stopscene' }])
                        const s = await ctx.replyWithHTML(
                            `📅 <b>Дата доставки:</b> ${ctx.wizard.state.date}\n` +
                            `⏰ <b>Временной интервал:</b> ${ctx.wizard.state.timeInterval}\n\n` +
                            `📦 <b>Укажите адрес для доставки:</b>`,
                            {
                                reply_markup: {
                                    inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'stopscene' }]]
                                }
                            }
                        );

                        ctx.wizard.state.messageId = s.message_id;
                        return ctx.wizard.next();
                    }
                }

                if (ctx.callbackQuery.data === 'time_back') {
                    const timeKeyboard = Markup.inlineKeyboard([
                        [
                            Markup.button.callback('🌅 Утро (8:00-11:00)', 'interval_8_11'),
                            Markup.button.callback('🌇 День (13:00-16:00)', 'interval_13_16')
                        ],
                        [Markup.button.callback('⏱ Выбрать вручную', 'manual_time')],
                        [Markup.button.callback('❌ Отмена', 'stopscene')]
                    ]);

                    await ctx.editMessageText(
                        `⏰ <b>Выберите временной интервал доставки:</b>`,
                        {parse_mode: 'HTML',
                            ...timeKeyboard}
                    );

                    delete ctx.wizard.state.timeSelectionStage;
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage();
            ctx.wizard.state.place = ctx.message.text;
            const s = await ctx.replyWithHTML(`👤 <b>Укажите физ/юр лицо заявки</b>`, {reply_markup: {inline_keyboard: [[{text: 'Физ. лицо', callback_data: 'entity:0'}],[{text: 'Юр. лицо', callback_data: 'entity:1'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`entity:`)){
                    await ctx.deleteMessage();
                    ctx.wizard.state.entity = {type: parseInt(ctx.callbackQuery.data.split(':')[1])};
                    const s = await ctx.replyWithHTML(`👤 <b>Если физ лицо, впишите имя клиента, при юр. лице вписывайте название компании.</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage();
            ctx.wizard.state.entity.text = ctx.message.text
            const s = await ctx.replyWithHTML(`📞 <b>Укажите номер телефона для заявки.</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage();
            let phone = formatPhoneNumber(ctx.message.text)
            if(phone){
                ctx.wizard.state.phone = phone;
                const allBeton = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=?`, [(await getUser(ctx.from.id)).zavod, `Beton`])
                const betonBut = allBeton.map(b =>
                    [{text: `${b.name} (${b.price_per_unit} руб/м³)`, callback_data:`type_${b.fid}`}]
                );
                betonBut.push([{ text: '❌ Отмена', callback_data: 'stopscene' }])
                const s = await ctx.replyWithHTML(`📦 <b>Выберите нужную марку бетона:</b>`,
                    {
                        reply_markup: {
                            inline_keyboard: betonBut
                        }
                    }
                );
                ctx.wizard.state.messageId = s.message_id;
                return ctx.wizard.next();
            }
            else{
                const s = await ctx.replyWithHTML(`<b>Вы ввели неверно телефон. Повторите ввод номера телефона.</b>`)
                ctx.wizard.state.messageId = s.message_id;
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`type_`)){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.betonType = parseInt(ctx.callbackQuery.data.split('_')[1]);
                    const s = await ctx.replyWithHTML(`⚖️ <b>Укажите объем/цену за кубометр со скидкой 
❗️Если цена по прайсу, напишите только объем❗️

(Пример 10/7000)</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage();
            const input = ctx.message.text.split('/');
            const price = await query(`SELECT * FROM nc WHERE fid=?`, [ctx.wizard.state.betonType]);
            if(input.length === 2 && !isNaN(input[0]) && !isNaN(input[1])){
                ctx.wizard.state.amount = input[0];
                ctx.wizard.state.userPrice = input[1];
                ctx.wizard.state.price = price[0].price_per_unit;
            }
            else{
                
                if(price.length > 0){
                    ctx.wizard.state.amount = ctx.message.text;
                    ctx.wizard.state.price = price[0].price_per_unit;
                    ctx.wizard.state.userPrice = price[0].price_per_unit;
                }
                else{
                    const s = await ctx.replyWithHTML(`❌ <b>Цена за кубометр не найдена в номенклатуре, введите свою. Укажите объем/цену за кубометр (Пример: 10/7000)</b>`);
                    ctx.wizard.state.messageId = s.message_id;
                    return;
                }
            }
            const s = await ctx.replyWithHTML(`<b>Обьем: ${ctx.wizard.state.amount} м³
Цена: ${ctx.wizard.state.userPrice} руб/м³
Итоговая цена: ${ctx.wizard.state.amount * ctx.wizard.state.userPrice} руб
                
💸 Выберите форму оплаты</b>`, {reply_markup: {inline_keyboard: [[{text: 'По факту на месте', callback_data: 'pay_form:0'}],[{text: 'Предоплата', callback_data: 'pay_form:1'}],[{text: 'Предоплата %', callback_data: 'pay_form:2'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`pay_form:`)){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    let form = parseInt(ctx.callbackQuery.data.split(':')[1]);
                    if(form !== 2){
                        ctx.wizard.state.payForm = form;
                        const s = await ctx.replyWithHTML(`<b>📦 Укажите: доставка по прайсу куб/Доставка за куб/количество кубов на доставку, или же: доставка по прайсу куб/количество кубов на доставку
                            
Пример 
900/10 (продажа без скидки)
800/900/10 (продажа со скидкой)</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                        return ctx.wizard.next();
                    }
                    else{
                        ctx.wizard.state.payForm = form;
                        ctx.wizard.state.enterProc = true;
                        const s = await ctx.replyWithHTML(`📎 <b>Введите процент предоплаты</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                    }
                }
            }
            else if(ctx.wizard.state.enterProc){
                ctx.deleteMessage();
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                delete ctx.wizard.state.enterProc;
                ctx.wizard.state.payFormProcent = parseInt(ctx.message.text);
                const s = await ctx.replyWithHTML(`<b>📦 Укажите: доставка по прайсу куб/Доставка за куб/количество кубов на доставку, или же: доставка по прайсу куб/количество кубов на доставку</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
                return ctx.wizard.next();
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage();
            const input = ctx.message.text.split('/');
            if(input.length === 3){
                ctx.wizard.state.delivery = {
                    price: input[0],
                    price_with_add: input[1],
                    amount: input[2]
                }
            }
            else if(input.length === 2){
                ctx.wizard.state.delivery = {
                    price: input[0],
                    amount: input[1],
                    price_with_add: null
                }
            }
            else{
                const s = await ctx.replyWithHTML(`❌ <b>Неверный формат доставки. Укажите: доставка по прайсу куб/Доставка за куб/количество кубов на доставку, или же: доставка по прайсу куб/количество кубов на доставку</b>`);
                ctx.wizard.state.messageId = s.message_id;
                return;
            }
            const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=-1`, [(await getUser(ctx.from.id)).zavod, 'Equimpent']);
            let but = all_dops.map(s => [{text: `${s.name}`, callback_data: `dop:${s.fid}`}]);
            but.push([{text: 'Далее', callback_data: 'next'}]);
            but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
            const s = await ctx.replyWithHTML(`📋 <b>Выберите доп. услуги к заявке:</b>`, {reply_markup:  {inline_keyboard: but}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`dop:`)){
                    const id = ctx.callbackQuery.data.split(':')[1];
                    const dop = (await query(`SELECT * FROM nc WHERE fid=?`, [id]))[0];
                    if(dop){
                        if(!ctx.wizard.state.dop){
                            ctx.wizard.state.dop = [];
                        }
                        const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=?`, [(await getUser(ctx.from.id)).zavod, 'Equimpent', dop.id]);
                        if(all_dops.length > 0){
                            const but = all_dops.map(s => [{text: `${s.name} (${s.price_per_unit} руб.)`, callback_data: `select_dop:${s.fid}`}]);
                            but.push([{text: 'Вернуться', callback_data: 'back_dop'}]);
                            but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                            await ctx.editMessageReplyMarkup({
                                inline_keyboard: but
                            });
                        }
                        else{
                            ctx.answerCbQuery();
                        }
                    }
                }
                else if(ctx.callbackQuery.data.startsWith(`select_dop:`)){
                    const id = ctx.callbackQuery.data.split(':')[1];
                    const dop = (await query(`SELECT * FROM nc WHERE fid=?`, [id]))[0];
                    if(dop){
                        if(!ctx.wizard.state.dop){
                            ctx.wizard.state.dop = [];
                        }
                        ctx.wizard.state.dop.push(dop);
                        await ctx.answerCbQuery(`✅ Доп. услуга ${dop.name} добавлена`);
                        const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=-1`, [(await getUser(ctx.from.id)).zavod, 'Equimpent']);
                        let but = all_dops.map(s => [{text: `${s.name}`, callback_data: `dop:${s.fid}`}]);
                        but.push([{text: 'Далее', callback_data: 'next'}]);
                        but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                        await ctx.editMessageReplyMarkup({
                            inline_keyboard: but
                        });
                    }
                }
                else if(ctx.callbackQuery.data === 'back_dop'){
                    const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=-1`, [(await getUser(ctx.from.id)).zavod, 'Equimpent']);
                    let but = all_dops.map(s => [{text: `${s.name}`, callback_data: `dop:${s.fid}`}]);
                    but.push([{text: 'Далее', callback_data: 'next'}]);
                    but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                    await ctx.editMessageReplyMarkup({
                        inline_keyboard: but
                    });
                }
                else if(ctx.callbackQuery.data === `next`){
                    ctx.deleteMessage(ctx.wizard.state.messageId)
                    const s = await ctx.replyWithHTML(`📷 <b>Для наиболее грамотной поставки бетона пришлите фото/видео подъездных путей, так логисты смогут подобрать наиболее подходящий вариант для вашего объекта</b>`, {reply_markup: {inline_keyboard: [[{text: 'Продолжить без фото', callback_data: 'noPhoto'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `noPhoto`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.photos = null;
                    ctx.wizard.state.video = null;
                    resultPrice(ctx)
                }
                else if(ctx.callbackQuery.data === `stop`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    resultPrice(ctx)
                }
            }
            else if(ctx.message.photo){
                if(!ctx.wizard.state.photo) ctx.wizard.state.photo = [];
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                ctx.wizard.state.photo.push(ctx.message.photo[ctx.message.photo.length - 1].file_id);
                const s = await ctx.replyWithHTML(`📷 <b>Добавлено фото!</b>`, {reply_markup: {inline_keyboard: [[{text: 'Закончить', callback_data: 'stop'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
            }
            else if(ctx.message.video){
                if(!ctx.wizard.state.video) ctx.wizard.state.video = [];
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                ctx.wizard.state.video.push(ctx.message.video.file_id);
                const s = await ctx.replyWithHTML(`📷 <b>Добавлено видео!</b>`, {reply_markup: {inline_keyboard: [[{text: 'Закончить', callback_data: 'stop'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
            }
            else{
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                const s = await ctx.replyWithHTML(`❌ <b>Требуется прислать фото/видео!</b>`, {reply_markup: {inline_keyboard: [[{text: 'Продолжить без фото', callback_data: 'noPhoto'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
                return
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`enter:`)){
                
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    let price = parseInt(ctx.callbackQuery.data.split(':')[1]);
                    if(price !== -1){
                        ctx.wizard.state.enterPrice = price;
                        exitPrice(ctx)
                    }
                    else{
                        ctx.wizard.state.enterUserPrice = true;
                        const s = await ctx.replyWithHTML(`💵 <b>Введите вашу стоимость входа в рублях</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                    }
                }
        
            }
            else if(ctx.wizard.state.enterUserPrice){
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                let price = parseInt(ctx.message.text);
                if(price > 0){
                    ctx.wizard.state.enterPrice = price;
                    exitPrice(ctx)
                }
                else{
                    const s = await ctx.replyWithHTML(`<b>Введите цифрами!</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`exit:`)){
                
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    let price = parseInt(ctx.callbackQuery.data.split(':')[1]);
                    if(price !== -1){
                        ctx.wizard.state.exitPrice = price;
                        const s = await ctx.replyWithHTML(`✏️ <b>Введите комментарий к заявке (Пример: форма одежды, требуется ли интервал между машинами, пожелания по доставке)</b>`, {reply_markup: {inline_keyboard: [[{text: 'Продолжить без комментария', callback_data: 'nocom'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                        return ctx.wizard.next();
                    }
                    else{
                        ctx.wizard.state.exitUserPrice = true;
                        const s = await ctx.replyWithHTML(`💵 <b>Введите вашу стоимость выхода в рублях</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                    }
                }
            }
            else if(ctx.wizard.state.exitUserPrice){
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                let price = parseInt(ctx.message.text);
                if(price > 0){
                    ctx.wizard.state.exitPrice = price;
                    const s = await ctx.replyWithHTML(`✏️ <b>Введите комментарий к заявке (Пример: форма одежды, требуется ли интервал между машинами, пожелания по доставке)</b>`, {reply_markup: {inline_keyboard: [[{text: 'Продолжить без комментария', callback_data: 'nocom'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
                else{
                    const s = await ctx.replyWithHTML(`<b>Введите цифрами!</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `nocom`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.com = 'Без комментария';
                    const s = await last(ctx)
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage()
            ctx.wizard.state.com = ctx.message.text;
            const s = await last(ctx)
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `create_anc`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.scene.leave();
                    const {id} = ctx.from
                    let user = await getUser(id);
                    const s = ctx.wizard.state;
                    let media = [];
                    let ph = [];
                    let vd = [];
                    if(ctx.wizard.state.photo !== undefined && ctx.wizard.state.photo?.length > 0){
                        ph = ctx.wizard.state.photo.map((fileId) => {
                        return {type: 'photo', fileId: fileId}});
                    }
                    if(ctx.wizard.state.video !== undefined && ctx.wizard.state.video?.length > 0){
                        vd = ctx.wizard.state.video.map((fileId) => {return {type: 'video', fileId: fileId}});
                    }
                    media = JSON.stringify(media.concat(ph,vd));
                    
                    let f;
                    if(s.payForm === 2){
                        f = `Предоплата ${s.payFormProcent}%`
                    }
                
                    let deliveryp = s.delivery.price;
                    if(s.delivery.price_with_add){
                        deliveryp = s.delivery.price_with_add
                    }
                
                    let dops = ``;
                    let price_dop = 0
                    for(const dop of s.dop){
                        dops += `\n• ${dop.name} - ${dop.price_per_unit} руб.`
                        price_dop += dop.price_per_unit;
                    }
                    const betont = (await query(`SELECT * FROM nc WHERE fid=?`,[s.betonType]))[0].name
                    const res = await createForm({
                        type: 1,
                        created_by: ctx.from.id,
                        date: `${s.date} | ${s.timeInterval}`,
                        place: s.place,
                        phone: s.phone,
                        betonType: betont,
                        betonAmount: parseInt(s.amount),
                        betonUserPrice: parseInt(s.userPrice),
                        betonPrice: parseInt(s.price),
                        payForm: f || payForms[s.payForm],
                        deliveryPriceWithAdd: deliveryp,
                        deliveryPrice: s.delivery.price,
                        deliveryAmount: s.delivery.amount,
                        dopAll: dops,
                        dopPrice: price_dop,
                        enterPrice: s.enterPrice,
                        exitPrice: s.exitPrice,
                        com: s.com,
                        real_name: user.real_name,
                        zavod: user.zavod,
                        status: 1,
                        priv: -1,
                        media: media,
                        last_fid: -1,
                        entity: ctx.wizard.state.entity.type,
                        entity_text: ctx.wizard.state.entity.text
                    })
                    if(res){
                        ctx.replyWithHTML(`<b>Заявка успешно создана под номером #${res}. Она будет отображаться в: "📋 Мои заявки"</b>`)
                    }
                }
            }
        },
    );

    const editmedia_form= new Scenes.WizardScene(
        'editmedia_form',
        async (ctx) => {
            const s = await ctx.replyWithHTML(`📷 <b>Пришлите фото/видео</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `stop`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    let media = JSON.parse((await query(`SELECT * FROM forms WHERE fid=?`, [ctx.wizard.state.anceta]))[0].media)
                    let ph = [];
                    let vd = [];
                    if(ctx.wizard.state.photo !== undefined && ctx.wizard.state.photo?.length > 0){
                        ph = ctx.wizard.state.photo.map((fileId) => {
                        return {type: 'photo', fileId: fileId}});
                    }
                    if(ctx.wizard.state.video !== undefined && ctx.wizard.state.video?.length > 0){
                        vd = ctx.wizard.state.video.map((fileId) => {return {type: 'video', fileId: fileId}});
                    }
                    media = JSON.stringify(media.concat(ph,vd));
                    await query(`UPDATE forms SET media=? WHERE fid=?`, [media, ctx.wizard.state.anceta])
                    ctx.replyWithHTML(`<b>Ваши медиафайлы успешно добавлены!</b>`)
                    return await ctx.scene.leave()
                }
            }
            else if(ctx.message.photo){
                if(!ctx.wizard.state.photo) ctx.wizard.state.photo = [];
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                ctx.wizard.state.photo.push(ctx.message.photo[ctx.message.photo.length - 1].file_id);
                const s = await ctx.replyWithHTML(`📷 <b>Добавлено фото!</b>`, {reply_markup: {inline_keyboard: [[{text: 'Закончить', callback_data: 'stop'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
            }
            else if(ctx.message.video){
                if(!ctx.wizard.state.video) ctx.wizard.state.video = [];
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                ctx.wizard.state.video.push(ctx.message.video.file_id);
                const s = await ctx.replyWithHTML(`📷 <b>Добавлено видео!</b>`, {reply_markup: {inline_keyboard: [[{text: 'Закончить', callback_data: 'stop'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
            }
            else{
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                const s = await ctx.replyWithHTML(`❌ <b>Требуется прислать фото/видео!</b>`, {reply_markup: {inline_keyboard: [[{text: 'Продолжить без фото', callback_data: 'noPhoto'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
                return
            }
        },
    );
    const edit_form= new Scenes.WizardScene(
        'edit_form',
        async (ctx) => {
            if(ctx.wizard.state.type === 0 || ctx.wizard.state.type === 1 || ctx.wizard.state.type === 3){
                const s = await ctx.replyWithHTML(editTypes[ctx.wizard.state.type].text, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
            }
            else if (ctx.wizard.state.type === 2){
                const allBeton = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=?`, [(await getUser(ctx.from.id)).zavod, `Beton`])
                const betonBut = allBeton.map(b =>
                    [{text: `${b.name}`, callback_data:`type_${b.fid}`}]
                );
                betonBut.push([{ text: '❌ Отмена', callback_data: 'stopscene' }])
                const s = await ctx.replyWithHTML(`📦 <b>Выберите нужную марку бетона:</b>`,
                    {
                        reply_markup: {
                            inline_keyboard: betonBut
                        }
                    }
                );
                ctx.wizard.state.messageId = s.message_id;
            }
            else if(ctx.wizard.state.type === 4){
                const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=-1`, [(await getUser(ctx.from.id)).zavod, 'Equimpent']);
                let but = all_dops.map(s => [{text: `${s.name}`, callback_data: `dop:${s.fid}`}]);
                but.push([{text: 'Далее', callback_data: 'next'}]);
                but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                const s = await ctx.replyWithHTML(`📋 <b>Выберите доп. услуги к заявке:</b>`, {reply_markup:  {inline_keyboard: but}});
                ctx.wizard.state.messageId = s.message_id;
            }
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`type_`)){
                    ctx.deleteMessage(ctx.wizard.state.messageId)
                    const beton = await query(`SELECT * FROM nc WHERE fid=?`, [parseInt(ctx.callbackQuery.data.split('_')[1])])
                    
                    await query(`UPDATE forms SET betonType=?, betonPrice=? WHERE fid=${ctx.wizard.state.fid}`, [beton[0].name, beton[0].price_per_unit])
                    index.openAncet(ctx, ctx.wizard.state.fid, 1)
                    return ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`dop:`)){
                    const id = ctx.callbackQuery.data.split(':')[1];
                    const dop = (await query(`SELECT * FROM nc WHERE fid=?`, [id]))[0];
                    if(dop){
                        if(!ctx.wizard.state.dop){
                            ctx.wizard.state.dop = [];
                        }
                        const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=?`, [(await getUser(ctx.from.id)).zavod, 'Equimpent', dop.id]);
                        if(all_dops.length > 0){
                            const but = all_dops.map(s => [{text: `${s.name} (${s.price_per_unit} руб.)`, callback_data: `select_dop:${s.fid}`}]);
                            but.push([{text: 'Вернуться', callback_data: 'back_dop'}]);
                            but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                            await ctx.editMessageReplyMarkup({
                                inline_keyboard: but
                            });
                        }
                        else{
                            ctx.answerCbQuery();
                        }
                    }
                }
                else if(ctx.callbackQuery.data.startsWith(`select_dop:`)){
                    const id = ctx.callbackQuery.data.split(':')[1];
                    const dop = (await query(`SELECT * FROM nc WHERE fid=?`, [id]))[0];
                    if(dop){
                        if(!ctx.wizard.state.dop){
                            ctx.wizard.state.dop = [];
                        }
                        ctx.wizard.state.dop.push(dop);
                        await ctx.answerCbQuery(`✅ Доп. услуга ${dop.name} добавлена`);
                        const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=-1`, [(await getUser(ctx.from.id)).zavod, 'Equimpent']);
                        let but = all_dops.map(s => [{text: `${s.name}`, callback_data: `dop:${s.fid}`}]);
                        but.push([{text: 'Далее', callback_data: 'next'}]);
                        but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                        await ctx.editMessageReplyMarkup({
                            inline_keyboard: but
                        });
                    }
                }
                else if(ctx.callbackQuery.data === 'back_dop'){
                    const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=-1`, [(await getUser(ctx.from.id)).zavod, 'Equimpent']);
                    let but = all_dops.map(s => [{text: `${s.name}`, callback_data: `dop:${s.fid}`}]);
                    but.push([{text: 'Далее', callback_data: 'next'}]);
                    but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                    await ctx.editMessageReplyMarkup({
                        inline_keyboard: but
                    });
                }
                else if(ctx.callbackQuery.data === `next`){
                    ctx.deleteMessage(ctx.wizard.state.messageId)
                    let dops = ``;
                    let price_dop = 0
                    for(const dop of ctx.wizard.state.dop){
                        dops += `\n• ${dop.name} - ${dop.price_per_unit} руб.`
                        price_dop += dop.price_per_unit;
                    }
                    await query(`UPDATE forms SET dopAll=?, dopPrice=? WHERE fid=${ctx.wizard.state.fid}`, [dops, price_dop])
                    index.openAncet(ctx, ctx.wizard.state.fid, 1)
                    return ctx.scene.leave();
                }
            }
            else{
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                await query(`UPDATE forms SET ${editTypes[ctx.wizard.state.type].key}=? WHERE fid=${ctx.wizard.state.fid}`, [ctx.message.text])
                index.openAncet(ctx, ctx.wizard.state.fid, 1)
                return ctx.scene.leave();
            }
        },
    );

    const manager_shet = new Scenes.WizardScene(
        'manager_calculate',
        async (ctx) => {
            const allBeton = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=?`, [(await getUser(ctx.from.id)).zavod, `Beton`])
            const betonBut = allBeton.map(b =>
                [{text: `${b.name} (${b.price_per_unit} руб/м³)`, callback_data:`type_${b.fid}`}]
            );
            betonBut.push([{ text: '❌ Отмена', callback_data: 'stopscene' }])
            const s = await ctx.replyWithHTML(`📦 <b>Выберите нужную марку бетона:</b>`,
                {
                        reply_markup: {
                        inline_keyboard: betonBut
                    }
                }
            );
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`type_`)){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.betonType = parseInt(ctx.callbackQuery.data.split('_')[1]);
                    const s = await ctx.replyWithHTML(`⚖️ <b>Укажите объем/цену за кубометр со скидкой 
❗️Если цена по прайсу, напишите только объем❗️

(Пример 10/7000)</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage();
            const input = ctx.message.text.split('/');
            const price = await query(`SELECT * FROM nc WHERE fid=?`, [ctx.wizard.state.betonType]);
            if(input.length === 2 && !isNaN(input[0]) && !isNaN(input[1])){
                ctx.wizard.state.amount = input[0];
                ctx.wizard.state.userPrice = input[1];
                ctx.wizard.state.price = price[0].price_per_unit;
            }
            else{
                
                if(price.length > 0){
                    ctx.wizard.state.amount = ctx.message.text;
                    ctx.wizard.state.price = price[0].price_per_unit;
                    ctx.wizard.state.userPrice = price[0].price_per_unit;
                }
                else{
                    const s = await ctx.replyWithHTML(`❌ <b>Цена за кубометр не найдена в номенклатуре, введите свою. Укажите объем/цену за кубометр (Пример: 10/7000)</b>`);
                    ctx.wizard.state.messageId = s.message_id;
                    return;
                }
            }
            const s = await ctx.replyWithHTML(`<b>Обьем: ${ctx.wizard.state.amount} м³
Цена: ${ctx.wizard.state.userPrice} руб/м³
Итоговая цена: ${ctx.wizard.state.amount * ctx.wizard.state.userPrice} руб
                
💸 Выберите форму оплаты</b>`, {reply_markup: {inline_keyboard: [[{text: 'По факту на месте', callback_data: 'pay_form:0'}],[{text: 'Предоплата', callback_data: 'pay_form:1'}],[{text: 'Предоплата %', callback_data: 'pay_form:2'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`pay_form:`)){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    let form = parseInt(ctx.callbackQuery.data.split(':')[1]);
                    if(form !== 2){
                        ctx.wizard.state.payForm = form;
                        const s = await ctx.replyWithHTML(`<b>📦 Укажите: доставка по прайсу куб/Доставка за куб/количество кубов на доставку, или же: доставка по прайсу куб/количество кубов на доставку
                            
Пример 
900/10 (продажа без скидки)
800/900/10 (продажа со скидкой)</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                        return ctx.wizard.next();
                    }
                    else{
                        ctx.wizard.state.payForm = form;
                        ctx.wizard.state.enterProc = true;
                        const s = await ctx.replyWithHTML(`📎 <b>Введите процент предоплаты</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                    }
                }
            }
            else if(ctx.wizard.state.enterProc){
                ctx.deleteMessage();
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                delete ctx.wizard.state.enterProc;
                ctx.wizard.state.payFormProcent = parseInt(ctx.message.text);
                const s = await ctx.replyWithHTML(`<b>📦 Укажите: доставка по прайсу куб/Доставка за куб/количество кубов на доставку, или же: доставка по прайсу куб/количество кубов на доставку</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                ctx.wizard.state.messageId = s.message_id;
                return ctx.wizard.next();
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage();
            const input = ctx.message.text.split('/');
            if(input.length === 3){
                ctx.wizard.state.delivery = {
                    price: input[0],
                    price_with_add: input[1],
                    amount: input[2]
                }
            }
            else if(input.length === 2){
                ctx.wizard.state.delivery = {
                    price: input[0],
                    amount: input[1],
                    price_with_add: null
                }
            }
            else{
                const s = await ctx.replyWithHTML(`❌ <b>Неверный формат доставки. Укажите: доставка по прайсу куб/Доставка за куб/количество кубов на доставку, или же: доставка по прайсу куб/количество кубов на доставку</b>`);
                ctx.wizard.state.messageId = s.message_id;
                return;
            }
            const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=-1`, [(await getUser(ctx.from.id)).zavod, 'Equimpent']);
            let but = all_dops.map(s => [{text: `${s.name}`, callback_data: `dop:${s.fid}`}]);
            but.push([{text: 'Далее', callback_data: 'next'}]);
            but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
            const s = await ctx.replyWithHTML(`📋 <b>Выберите доп. услуги к заявке:</b>`, {reply_markup:  {inline_keyboard: but}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`dop:`)){
                    const id = ctx.callbackQuery.data.split(':')[1];
                    const dop = (await query(`SELECT * FROM nc WHERE fid=?`, [id]))[0];
                    if(dop){
                        if(!ctx.wizard.state.dop){
                            ctx.wizard.state.dop = [];
                        }
                        const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=?`, [(await getUser(ctx.from.id)).zavod, 'Equimpent', dop.id]);
                        if(all_dops.length > 0){
                            const but = all_dops.map(s => [{text: `${s.name} (${s.price_per_unit} руб.)`, callback_data: `select_dop:${s.fid}`}]);
                            but.push([{text: 'Вернуться', callback_data: 'back_dop'}]);
                            but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                            await ctx.editMessageReplyMarkup({
                                inline_keyboard: but
                            });
                        }
                        else{
                            ctx.answerCbQuery();
                        }
                    }
                }
                else if(ctx.callbackQuery.data.startsWith(`select_dop:`)){
                    const id = ctx.callbackQuery.data.split(':')[1];
                    const dop = (await query(`SELECT * FROM nc WHERE fid=?`, [id]))[0];
                    if(dop){
                        if(!ctx.wizard.state.dop){
                            ctx.wizard.state.dop = [];
                        }
                        ctx.wizard.state.dop.push(dop);
                        await ctx.answerCbQuery(`✅ Доп. услуга ${dop.name} добавлена`);
                        const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=-1`, [(await getUser(ctx.from.id)).zavod, 'Equimpent']);
                        let but = all_dops.map(s => [{text: `${s.name}`, callback_data: `dop:${s.fid}`}]);
                        but.push([{text: 'Далее', callback_data: 'next'}]);
                        but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                        await ctx.editMessageReplyMarkup({
                            inline_keyboard: but
                        });
                    }
                }
                else if(ctx.callbackQuery.data === 'back_dop'){
                    const all_dops = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=? AND rod_id=-1`, [(await getUser(ctx.from.id)).zavod, 'Equimpent']);
                    let but = all_dops.map(s => [{text: `${s.name}`, callback_data: `dop:${s.fid}`}]);
                    but.push([{text: 'Далее', callback_data: 'next'}]);
                    but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
                    await ctx.editMessageReplyMarkup({
                        inline_keyboard: but
                    });
                }
                else if(ctx.callbackQuery.data === `next`){
                    ctx.deleteMessage(ctx.wizard.state.messageId)
                
                    resultPrice(ctx)
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`enter:`)){
                
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    let price = parseInt(ctx.callbackQuery.data.split(':')[1]);
                    if(price !== -1){
                        ctx.wizard.state.enterPrice = price;
                        exitPrice(ctx)
                    }
                    else{
                        ctx.wizard.state.enterUserPrice = true;
                        const s = await ctx.replyWithHTML(`💵 <b>Введите вашу стоимость входа в рублях</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                    }
                }
        
            }
            else if(ctx.wizard.state.enterUserPrice){
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                let price = parseInt(ctx.message.text);
                if(price > 0){
                    ctx.wizard.state.enterPrice = price;
                    exitPrice(ctx)
                }
                else{
                    const s = await ctx.replyWithHTML(`<b>Введите цифрами!</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`exit:`)){
                
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    let price = parseInt(ctx.callbackQuery.data.split(':')[1]);
                    if(price !== -1){
                        ctx.wizard.state.exitPrice = price;
                        const s = await last_calc(ctx)
                        ctx.wizard.state.messageId = s.message_id;
                        return ctx.wizard.next();
                    }
                    else{
                        ctx.wizard.state.exitUserPrice = true;
                        const s = await ctx.replyWithHTML(`💵 <b>Введите вашу стоимость выхода в рублях</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                    }
                }
            }
            else if(ctx.wizard.state.exitUserPrice){
                await ctx.deleteMessage(ctx.wizard.state.messageId)
                await ctx.deleteMessage()
                let price = parseInt(ctx.message.text);
                if(price > 0){
                    ctx.wizard.state.exitPrice = price;
                    const s = await last_calc(ctx)
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
                else{
                    const s = await ctx.replyWithHTML(`<b>Введите цифрами!</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `create_anc`){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.scene.leave();
                    const {id} = ctx.from
                    let user = await getUser(id);
                    const s = ctx.wizard.state;
                    const an = ctx.wizard.state.an

                    media = an.media;
                    
                    let f;
                    if(s.payForm === 2){
                        f = `Предоплата ${s.payFormProcent}%`
                    }
                
                    let deliveryp = s.delivery.price;
                    if(s.delivery.price_with_add){
                        deliveryp = s.delivery.price_with_add
                    }
                
                    let dops = ``;
                    let price_dop = 0
                    for(const dop of s.dop){
                        dops += `\n• ${dop.name} - ${dop.price_per_unit} руб.`
                        price_dop += dop.price_per_unit;
                    }
                    const betont = (await query(`SELECT * FROM nc WHERE fid=?`,[s.betonType]))[0].name
                    const res = await createForm({
                        type: 2,
                        created_by: ctx.from.id,
                        date: an.date,
                        place: an.place,
                        phone: an.phone,
                        betonType: betont,
                        betonAmount: parseInt(s.amount),
                        betonUserPrice: parseInt(s.userPrice),
                        betonPrice: parseInt(s.price),
                        payForm: f || payForms[s.payForm],
                        deliveryPriceWithAdd: deliveryp,
                        deliveryPrice: s.delivery.price,
                        deliveryAmount: s.delivery.amount,
                        dopAll: dops,
                        dopPrice: price_dop,
                        enterPrice: s.enterPrice,
                        exitPrice: s.exitPrice,
                        com: an.com,
                        real_name: user.real_name,
                        zavod: user.zavod,
                        status: 1,
                        priv: an.created_by,
                        media: media,
                        last_fid: an.fid
                    })
                    if(res){
                        ctx.replyWithHTML(`<b>Заявка успешно создана под номером #${res}. Она будет отображаться в: "📩 Входящие заявки"</b>`)
                        if(ctx.wizard.state.an.to === -1){
                            ctx.telegram.sendMessage(`<b>На вашу заявку откликнулся один из заводов! Посмотрите предложение в "🗂 Мои предложения"</b>`)
                        }
                        else if(ctx.wizard.state.an.to === (await getUser(ctx.from.id)).zavod){
                            ctx.telegram.sendMessage(`<b>На вашу заявку откликнулся завод! Заявка находится в "🗂 Мои предложения"</b>`)
                        }
                    }
                }
            }
        },
    );

    const search_ancet = new Scenes.WizardScene(
        `search_ancet`, 
        async (ctx) => {
        const s = await ctx.replyWithHTML(`<b>Введите ID заявки или номер телефона привязанный к заявке</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
        ctx.wizard.state.messageId = s.message_id;
        return ctx.wizard.next();
        },
        async (ctx) => {
        if(ctx.callbackQuery){
            if(ctx.callbackQuery.data === `stopscene`){
                ctx.deleteMessage();
                return await ctx.scene.leave();
            }
        }
        else{
            const id = parseInt(ctx.message.text);
            if(id > 0){
                const anc = (await query(`SELECT * FROM forms WHERE type=2 AND fid=? AND zavod=?`, [id, (await getUser(ctx.from.id)).zavod]))[0]
                if(anc){
                    ctx.replyWithHTML(`<b>Заявка #${anc.fid} найдена</b>`, {reply_markup: {inline_keyboard: [[{text: 'Посмотреть заявку', callback_data: `incoming_kp_go:${id}`}]]}});
                }
                else{
                    const form = formatPhoneNumber(ctx.message.text)
                    const anc = (await query(`SELECT * FROM forms WHERE type=2 AND phone=? AND zavod=?`, [form, (await getUser(ctx.from.id)).zavod]))[0]
                    if(anc){
                        ctx.replyWithHTML(`<b>Заявка #${anc.fid} найдена</b>`, {reply_markup: {inline_keyboard: [[{text: 'Посмотреть заявку', callback_data: `incoming_kp_go:${anc.fid}`}]]}});
                    }
                    else{
                        ctx.replyWithHTML(`❌ <b>Заявка не найдена в базе!</b>`)
                    }
                }
            }
            else{
                const form = formatPhoneNumber(ctx.message.text)
                const anc = (await query(`SELECT * FROM forms WHERE type=2 AND phone=? AND zavod=?`, [form, (await getUser(ctx.from.id)).zavod]))[0]
                if(anc){
                    ctx.replyWithHTML(`<b>Заявка #${anc.fid} найдена</b>`, {reply_markup: {inline_keyboard: [[{text: 'Посмотреть заявку', callback_data: `incoming_kp_go:${anc.fid}`}]]}});
                }
                else{
                    ctx.replyWithHTML(`❌ <b>Заявка не найдена в базе!</b>`)
                }
            }
            return await ctx.scene.leave();
        }
        }
    );

    const booking_own_car = new Scenes.WizardScene(
        `booking_own_car`, 
        async (ctx) => {
            const but = (await query(`SELECT * FROM cars WHERE zavod=?`, [(await getUser(ctx.from.id)).zavod])).map(s => [{text: `${s.name}`, callback_data: `car:${s.fid}`}]);
            but.push([{text: 'Выбрал', callback_data: 'next'}]);
            but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
            ctx.wizard.state.selectedCars = {};
            const s = await ctx.replyWithHTML(`<b>Выберете машины из списка</b>
<i>Если количество рейсов больше 1, то укажите ид машины/количество рейсов (пример: 3/2)</i>`, {reply_markup: {inline_keyboard: but}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                if (ctx.callbackQuery.data.startsWith(`car:`)) {
                    const id = ctx.callbackQuery.data.split(':')[1];
                    ctx.wizard.state.selectedCars = ctx.wizard.state.selectedCars || {};
                    ctx.wizard.state.selectedCars[id] = {count: (ctx.wizard.state.selectedCars[id]?.count || 0) + 1, name: (await query(`SELECT * FROM cars WHERE fid=?`, [id]))[0].name, id: id, driver: (await query(`SELECT * FROM cars WHERE fid=?`, [id]))[0].driver};
                    await ctx.answerCbQuery(`✅ Машина выбрана, ${ctx.wizard.state.selectedCars[id]} рейс(ов)`);
                    const all_cars = await query(`SELECT * FROM cars WHERE zavod=?`, [(await getUser(ctx.from.id)).zavod]);
                    const selected = ctx.wizard.state.selectedCars;
                    const but = all_cars.map(s => {
                      const count = selected[s.fid]?.count || 0;
                      let text = `${s.name}`;
                      let but;
                      if (count > 0) {
                        text = `${s.name}`;
                        but = [{ text, callback_data: `car:${s.fid}`}, {text: `(${count} рейс${count > 1 ? 'ов' : ''})`, callback_data: `ignore`},{text: '✕', callback_data: `remove_car:${s.fid}`}];
                      }
                      else{
                        but = [{ text, callback_data: `car:${s.fid}`}];
                      }
                      return but;
                    });
                    but.push([{ text: 'Выбрал', callback_data: 'next' }]);
                    but.push([{ text: '❌ Отмена', callback_data: 'stopscene' }]);
                    await ctx.editMessageReplyMarkup({ inline_keyboard: but });
                }
                else if(ctx.callbackQuery.data.startsWith(`remove_car:`)){
                    const id = ctx.callbackQuery.data.split(':')[1];
                    ctx.wizard.state.selectedCars = ctx.wizard.state.selectedCars || {};
                    delete ctx.wizard.state.selectedCars[id];
                    await ctx.answerCbQuery(`✅ Машина сброшена`);
                    const all_cars = await query(`SELECT * FROM cars WHERE zavod=?`, [(await getUser(ctx.from.id)).zavod]);
                    const selected = ctx.wizard.state.selectedCars;
                    const but = all_cars.map(s => {
                      const count = selected[s.fid]?.count || 0;
                      let text = `${s.name}`;
                      let but;
                      if (count > 0) {
                        text = `${s.name}`;
                        but = [{ text, callback_data: `car:${s.fid}`}, {text: `(${count} рейс${count > 1 ? 'ов' : ''})`, callback_data: `ignore`}, {text: '✕', callback_data: `remove_car:${s.fid}`}];
                      }
                      else{
                        but = [{ text, callback_data: `car:${s.fid}`}];
                      }
                      return but;
                    });
                    but.push([{ text: 'Выбрал', callback_data: 'next' }]);
                    but.push([{ text: '❌ Отмена', callback_data: 'stopscene' }]);
                    await ctx.editMessageReplyMarkup({ inline_keyboard: but });
                }
                else if(ctx.callbackQuery.data === 'next'){
            
                    for(const car of Object.values(ctx.wizard.state.selectedCars)){
                        try{
                            await db.addCarToForm(ctx.wizard.state.fid, car.id, car.name, car.count, 0)
                            await ctx.telegram.sendMessage(car.driver, `<i>У вас новая заявка!</i>
    
    ❗️<b>Не забудьте завершить заявку после отливки в разделе ЗАЯВКИ В РАБОТЕ</b>`, {parse_mode: 'HTML'})
                        }
                        catch(e){

                        }
                    }
                    await db.updateForm(ctx.wizard.state.fid, 'status', 2)
                    ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.replyWithHTML(`<b>Анкета успешно забронирована!</b>`);
                    ctx.scene.leave();
                }
                else{
                    ctx.answerCbQuery();
                }
            }
        }
    );

    const booking_own_car_carrier = new Scenes.WizardScene(
        `booking_own_car_carrier`, 
        async (ctx) => {
            const but = (await query(`SELECT * FROM cars WHERE zavod=?`, [(await getUser(ctx.from.id)).zavod])).map(s => [{text: `${s.name}`, callback_data: `car:${s.fid}`}]);
            but.push([{text: 'Выбрал', callback_data: 'next'}]);
            but.push([{text: '❌ Отмена', callback_data: 'stopscene'}]);
            ctx.wizard.state.selectedCars = {};
            const s = await ctx.replyWithHTML(`<b>Выберете машины из списка</b>
<i>Если количество рейсов больше 1, то укажите ид машины/количество рейсов (пример: 3/2)</i>`, {reply_markup: {inline_keyboard: but}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                if (ctx.callbackQuery.data.startsWith(`car:`)) {
                    const id = ctx.callbackQuery.data.split(':')[1];
                    ctx.wizard.state.selectedCars = ctx.wizard.state.selectedCars || {};
                    ctx.wizard.state.selectedCars[id] = {count: (ctx.wizard.state.selectedCars[id]?.count || 0) + 1, name: (await query(`SELECT * FROM cars WHERE fid=?`, [id]))[0].name, id: id, driver: (await query(`SELECT * FROM cars WHERE fid=?`, [id]))[0].driver};
                    await ctx.answerCbQuery(`✅ Машина выбрана, ${ctx.wizard.state.selectedCars[id]} рейс(ов)`);
                    const all_cars = await query(`SELECT * FROM cars WHERE zavod=?`, [(await getUser(ctx.from.id)).zavod]);
                    const selected = ctx.wizard.state.selectedCars;
                    const but = all_cars.map(s => {
                      const count = selected[s.fid]?.count || 0;
                      let text = `${s.name}`;
                      let but;
                      if (count > 0) {
                        text = `${s.name}`;
                        but = [{ text, callback_data: `car:${s.fid}`}, {text: `(${count} рейс${count > 1 ? 'ов' : ''})`, callback_data: `ignore`},{text: '✕', callback_data: `remove_car:${s.fid}`}];
                      }
                      else{
                        but = [{ text, callback_data: `car:${s.fid}`}];
                      }
                      return but;
                    });
                    but.push([{ text: 'Выбрал', callback_data: 'next' }]);
                    but.push([{ text: '❌ Отмена', callback_data: 'stopscene' }]);
                    await ctx.editMessageReplyMarkup({ inline_keyboard: but });
                }
                else if(ctx.callbackQuery.data.startsWith(`remove_car:`)){
                    const id = ctx.callbackQuery.data.split(':')[1];
                    ctx.wizard.state.selectedCars = ctx.wizard.state.selectedCars || {};
                    delete ctx.wizard.state.selectedCars[id];
                    await ctx.answerCbQuery(`✅ Машина сброшена`);
                    const all_cars = await query(`SELECT * FROM cars WHERE zavod=?`, [(await getUser(ctx.from.id)).zavod]);
                    const selected = ctx.wizard.state.selectedCars;
                    const but = all_cars.map(s => {
                      const count = selected[s.fid]?.count || 0;
                      let text = `${s.name}`;
                      let but;
                      if (count > 0) {
                        text = `${s.name}`;
                        but = [{ text, callback_data: `car:${s.fid}`}, {text: `(${count} рейс${count > 1 ? 'ов' : ''})`, callback_data: `ignore`}, {text: '✕', callback_data: `remove_car:${s.fid}`}];
                      }
                      else{
                        but = [{ text, callback_data: `car:${s.fid}`}];
                      }
                      return but;
                    });
                    but.push([{ text: 'Выбрал', callback_data: 'next' }]);
                    but.push([{ text: '❌ Отмена', callback_data: 'stopscene' }]);
                    await ctx.editMessageReplyMarkup({ inline_keyboard: but });
                }
                else if(ctx.callbackQuery.data === 'next'){
                    for(const car of Object.values(ctx.wizard.state.selectedCars)){
                        await db.addCarToForm(ctx.wizard.state.fid, car.id,car.name, car.count, 1)
                        try{
                            await ctx.telegram.sendMessage(car.driver, `<i>У вас новая заявка!</i>

❗️<b>Не забудьте завершить заявку после отливки в разделе ЗАЯВКИ В РАБОТЕ</b>`, {parse_mode: 'HTML'})
                        }
                        catch(e){
                            
                        }
                    }
                    await db.updateForm(ctx.wizard.state.fid, 'to_carrier', (await getUser(ctx.from.id)).zavod)
                    await db.updateForm(ctx.wizard.state.fid, 'status', 2)
                    ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.replyWithHTML(`<b>Анкета успешно забронирована!</b>`);
                    ctx.scene.leave();
                }
                else{
                    ctx.answerCbQuery();
                }
            }
        }
    );

    const offer_conditions = new Scenes.WizardScene(
        `offer_conditions`, 
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Выберите свой вариант условий при котором вы забронируйте машину на заявку, логист его увидет и сможет оперативно скорректировать заявку</b>`, {reply_markup: {inline_keyboard: [[{text: 'Доставка за куб', callback_data: 'condition:carrier_price'}],[{text: 'Комментарий', callback_data: 'condition:com'}],[{text: 'Время доставки', callback_data: 'condition:date'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === 'stopscene'){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith('condition:')){
                    ctx.deleteMessage();
                    let text = '<b>Введите цену за куб (Пишите только цифры)</b>'
                    if(ctx.callbackQuery.data === 'condition:com'){
                        text = '<b>Введите комментарий</b>'
                    }
                    else if(ctx.callbackQuery.data === 'condition:date'){
                        text = '<b>Введите новое время доставки по формату дд.мм.гггг чч:мм-чч:мм (Пример: 15.06.2025 10:00-12:00)</b>'
                    }
                    const s = await ctx.replyWithHTML(text, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    ctx.wizard.state.do = ctx.callbackQuery.data.split(':')[1];
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === 'stopscene'){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            else if(ctx.message?.text){
                if(hasDangerousChars(ctx.message.text)) return;

                let edit = '';
                switch(ctx.wizard.state.do){
                    case 'carrier_price':
                        edit = 'Стоимость доставки за куб';
                        if(parseInt(ctx.message.text) < 1){
                            return ctx.replyWithHTML(`❌ <b>Цена не может быть меньше 1 рубля!</b>`)
                        }
                        break;
                    case 'com':
                        edit = 'Комментарий';
                        break;
                    case 'date':
                        edit = 'Время доставки';
                        break;
                }
                const insertId = await db.createOfferConditions(ctx.wizard.state.fid, ctx.wizard.state.do, ctx.message.text, ctx.from.id)
                const form = await db.getForm(ctx.wizard.state.fid)
                ctx.telegram.sendMessage(form.logist_id, `<b>Перевозчик запросил свои условия доставки для заявки #${form.fid} ${form.betonAmount}м³ ${form.betonType}</b>
<b>Условие: ${edit}</b>
<b>Значение: ${ctx.message.text}</b>`, {parse_mode: 'HTML', reply_markup: {inline_keyboard: [[{text: '✅ Принять', callback_data: `accept_condition:${insertId}`},{text: '❌ Отклонить', callback_data: `reject_condition:${insertId}`}]]}});
                ctx.deleteMessage();
                ctx.deleteMessage(ctx.wizard.state.messageId);
                ctx.replyWithHTML(`<b>Условие успешно добавлено!</b>`)
                ctx.scene.leave();
            }
        }
    );

    const finish_form = new Scenes.WizardScene(
        `finish_form`,
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>У вас закрывающий рейс?</b>`, {reply_markup: {inline_keyboard: [[{text: 'Нет', callback_data: 'trip:1'},{text: 'Да', callback_data: 'trip:0'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === 'stopscene'){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith('trip:')){
                    ctx.deleteMessage();
                    ctx.wizard.state.isLastTrip = parseInt(ctx.callbackQuery.data.split(':')[1]) === 0;
                    const s = await ctx.replyWithHTML(`<b>Какой обьем выгрузили? (Пишите только цифры, указывайте в м³)</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === 'stopscene'){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            else if(ctx.message?.text){
                if(hasDangerousChars(ctx.message.text)) return;
                if(parseInt(ctx.message.text) < 1){
                    return ctx.replyWithHTML(`❌ <b>Обьем не может быть меньше 1 м³!</b>`)
                }
                ctx.wizard.state.betonAmount = parseInt(ctx.message.text);
                ctx.deleteMessage();
                ctx.deleteMessage(ctx.wizard.state.messageId);
                ctx.replyWithHTML(`<b>Как вы забрали деньги у клиента? Если вы брали наличкой то введите сумму (Пишите только цифры, в рублях, пример: 50000)</b>`, {reply_markup: {inline_keyboard: [                    
                    [{text: 'Юр. лицо', callback_data: 'payment:Юр. лицо'}],
                    [{text: 'Перевод', callback_data: 'payment:Перевод'}],
                    [{text: 'Не брал', callback_data: 'payment:Не брал'}],
                    [{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                return ctx.wizard.next();

            }
        },
        async (ctx) => {

            let but;

            if((await db.findCarByDriver(ctx.from.id))?.name?.slice(0, -2).endsWith('АБН')){
                but = [
                    [{text: `Бетоногаситель`, callback_data: 'select:Бетоногаситель'}],
                    [{text: `Простой`, callback_data: 'select:Простой'}],
                    [{text: `Шланг`, callback_data: 'select:Шланг'}],
                    [{text: `Трубы`, callback_data: 'select:Трубы'}],
                    [{text: `Перестановка`, callback_data: 'select:Перестановка'}],
                    [{text: `Замывка вне объекта`, callback_data: 'select:Замывка вне объекта'}],
                    [{text: `Продолжить`, callback_data: 'next'}],
                    [{text: `❌ Отмена`, callback_data: 'stopscene'}]
                ]
            }
            else{
                but = [
                    [{text: `Простой`, callback_data: 'select:Простой'}],
                    [{text: `Труба 6м`, callback_data: 'select:Шланг'}],
                    [{text: `Замывка вне объекта`, callback_data: 'select:Замывка вне объекта'}],
                    [{text: `Продолжить`, callback_data: 'next'}],
                    [{text: `❌ Отмена`, callback_data: 'stopscene'}]
                ]
            }
            
            if(ctx.callbackQuery){  
                if(ctx.callbackQuery.data === 'stopscene'){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith('payment:')){
                    ctx.deleteMessage();
                    ctx.wizard.state.money = {type: ctx.callbackQuery.data.split(':')[1], sum: 0};
                    const s = await ctx.replyWithHTML(`<b>Какие доп. услуги были предоставлены?</b>`, {reply_markup: {inline_keyboard: but}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
            else if(ctx.message?.text){
                if(hasDangerousChars(ctx.message.text)) return;
                if(parseInt(ctx.message.text) < 0){
                    return ctx.replyWithHTML(`❌ <b>Сумма не может быть меньше 0 рублей!</b>`)
                }
                ctx.wizard.state.money = {type: 'Наличные', sum: parseInt(ctx.message.text)};
                ctx.deleteMessage();
                ctx.deleteMessage(ctx.wizard.state.messageId);
                const s = await ctx.replyWithHTML(`<b>Какие доп. услуги были предоставлены?</b>`, {reply_markup: {inline_keyboard: but}});
                ctx.wizard.state.messageId = s.message_id;
                return ctx.wizard.next();
            }
        },
        async (ctx) => {
            let but_for_keyboard;

            if((await db.findCarByDriver(ctx.from.id))?.name?.slice(0, -2).endsWith('АБН')){
                but_for_keyboard = [
                    `Бетоногаситель`,
                    `Простой`,
                    `Шланг`,
                    `Трубы`,
                    `Перестановка`,
                    `Замывка вне объекта`
                ]
            }
            else{
                but_for_keyboard = [
                    `Простой`,
                    `Труба 6м`,
                    `Замывка вне объекта`,
                ]
            }
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === 'stopscene'){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith('select:')){
                    ctx.deleteMessage();
                    if(!ctx.wizard.state.dop) ctx.wizard.state.dop = [];
                    if(!ctx.wizard.state.dop_edit) ctx.wizard.state.dop_edit = [];
                    const data = ctx.callbackQuery.data.split(':')[1];
                    if(ctx.wizard.state.dop[data]) delete ctx.wizard.state.dop[data];
                    else ctx.wizard.state.dop[data] = data;
    
                    let but = [];
                    for(const b of but_for_keyboard){
                        if(ctx.wizard.state.dop[b]) but.push([{text: '✅ ' + b, callback_data: `select:${b}`}]);
                        else but.push([{text: b, callback_data: `select:${b}`}]);
                    }
    
                    for(const b in ctx.wizard.state.dop_edit){
                        if(ctx.wizard.state.dop_edit[b]) but.push([{text: '✅ ' + b, callback_data: `none`}]);
                    }
                    but.push([{text: 'Продолжить', callback_data: 'next'}], [{text: '❌ Отмена', callback_data: 'stopscene'}]);

                    const s = await ctx.replyWithHTML(`<b>Какие доп. услуги были предоставлены? Если ваших услуг нет, то введите текстом</b>`, {reply_markup: {inline_keyboard: but}});
                    ctx.wizard.state.messageId = s.message_id;
                }
                else if(ctx.callbackQuery.data === `next`){
                    ctx.deleteMessage();
                    const but = [[{text: '❌ Отмена', callback_data: 'stopscene'}]];
                    const s = await ctx.replyWithHTML(`<b>Прикрепите к заявке фото ТТН</b>`, {reply_markup: {inline_keyboard: but}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next()
                }
            }
            else if(ctx.message?.text){
                ctx.deleteMessage(ctx.wizard.state.messageId)
                ctx.deleteMessage();
                if(!ctx.wizard.state.dop) ctx.wizard.state.dop = [];
                if(!ctx.wizard.state.dop_edit) ctx.wizard.state.dop_edit = [];
                const data = ctx.message.text;
                if(ctx.wizard.state.dop_edit[data]) delete ctx.wizard.state.dop_edit[data];
                else ctx.wizard.state.dop_edit[data] = data;

                let but = [];
                for(const b of but_for_keyboard){
                    if(ctx.wizard.state.dop[b]) but.push([{text: '✅ ' + b, callback_data: `select:${b}`}]);
                    else but.push([{text: b, callback_data: `select:${b}`}]);
                }

                for(const b in ctx.wizard.state.dop_edit){
                    if(ctx.wizard.state.dop_edit[b]) but.push([{text: '✅ ' + b, callback_data: `none`}]);
                }
                but.push([{text: 'Продолжить', callback_data: 'next'}], [{text: '❌ Отмена', callback_data: 'stopscene'}]);

                const s = await ctx.replyWithHTML(`<b>Какие доп. услуги были предоставлены? Если ваших услуг нет, то введите текстом</b>`, {reply_markup: {inline_keyboard: but}});
                ctx.wizard.state.messageId = s.message_id;
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === 'stopscene'){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            else if(ctx.message?.photo){
                ctx.wizard.state.TTN = ctx.message?.photo[ctx.message.photo.length - 1]?.file_id || `-`;
                ctx.deleteMessage();
                ctx.deleteMessage(ctx.wizard.state.messageId);
                let all_dops = ``;
                for(const dop in ctx.wizard.state.dop){
                    all_dops += dop + '\n'
                }
                for(const dop in ctx.wizard.state.dop_edit){
                    all_dops += dop + '\n'
                }

                await db.addDriverFinishForm({
                    form_id: ctx.wizard.state.form_id,
                    created_by: ctx.from.id,
                    amount: ctx.wizard.state.betonAmount,
                    money_get: ctx.wizard.state.money.sum,
                    money_type: ctx.wizard.state.money.type,
                    dops: all_dops,
                    ttn: ctx.wizard.state.TTN,
                    carname: (await db.getCarByDriver(ctx.from.id)).name || 'Неизвестная машина'
                })

                if(ctx.wizard.state.isLastTrip) await db.updateForm(ctx.wizard.state.form_id, `status`, 3);
                ctx.replyWithHTML(`Спасибо за информацию по заявке! Ожидайте следующих или отработайте действующие заявки в разделе "мои заявки" –> "Завершенные"`)
                return ctx.scene.leave();

            }
        }
    );

    const attachToForm = new Scenes.WizardScene(
        `attachToForm`,
        async (ctx) => {
            const s = await ctx.replyWithHTML(`<b>Введите номер заявки к которой нужно привязаться</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === 'stopscene'){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            else if(ctx.message?.text){
                try{
                    const form = await db.getForm(parseInt(ctx.message.text));
                    if(form){
                        const car = await db.getCarByDriver(ctx.from.id);
                        if(car){
                            ctx.scene.leave()
                            const res = await db.addCarToForm(form.fid, car.fid, car.name, 1, 0);
                            ctx.replyWithHTML(`<b>Вы успешно привязаны к заявке!</b>`)
                        }
                    }
                    else{
                        const s = await ctx.replyWithHTML(`<b>Заявка не найдена! Введите еще раз.</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                        ctx.wizard.state.messageId = s.message_id;
                    }
                }
                catch(er){
                    const s = await ctx.replyWithHTML(`<b>Заявка не найдена! Введите еще раз.</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                }
            }
        },
    )

    const create_pickup_form = new Scenes.WizardScene(
        `create_pickup_form`,
        async (ctx) => {
            const calendarKeyboard = calendar.getCalendar(new Date())
            const cancelButton = Markup.button.callback('❌ Отмена', 'stopscene');
            const s = await ctx.replyWithHTML(`📆 <b>Укажите дату и время когда требуется бетон</b>`, { reply_markup: { inline_keyboard: [
                        ...calendarKeyboard.reply_markup.inline_keyboard,
                        [cancelButton]
                    ]
                }});
            ctx.wizard.state.messageId = s.message_id;
            const now = new Date();
            ctx.wizard.state.calendarMessageId = s.message_id;
            ctx.wizard.state.currentMonth = now.getMonth();
            ctx.wizard.state.currentYear = now.getFullYear();
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }

                if (ctx.callbackQuery.data.startsWith('calendar-telegram-prev')) {
                    const { currentMonth, currentYear } = ctx.wizard.state;
                    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

                    ctx.wizard.state.currentMonth = prevMonth;
                    ctx.wizard.state.currentYear = prevYear;

                    const newDate = new Date(prevYear, prevMonth, 1);
                    const newCalendar = calendar.getCalendar(newDate);

                    await ctx.editMessageReplyMarkup({
                        inline_keyboard: [
                            ...newCalendar.reply_markup.inline_keyboard,
                            [Markup.button.callback('❌ Отмена', 'stopscene')]
                        ]
                    });
                    return;
                }

                if (ctx.callbackQuery.data.startsWith('calendar-telegram-next')) {
                    const { currentMonth, currentYear } = ctx.wizard.state;
                    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
                    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

                    ctx.wizard.state.currentMonth = nextMonth;
                    ctx.wizard.state.currentYear = nextYear;

                    const newDate = new Date(nextYear, nextMonth, 1);
                    const newCalendar = calendar.getCalendar(newDate);

                    await ctx.editMessageReplyMarkup({
                        inline_keyboard: [
                            ...newCalendar.reply_markup.inline_keyboard,
                            [Markup.button.callback('❌ Отмена', 'stopscene')]
                        ]
                    });
                    return;
                }

                else if (ctx.callbackQuery.data.startsWith('calendar-telegram-ignore')) {
                    return ctx.answerCbQuery();
                }
                else if (ctx.callbackQuery.data.startsWith('calendar-telegram')) {
                    const dateStr = ctx.callbackQuery.data.replace('calendar-telegram-date-', '');
                    const [year, month, day] = dateStr.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.date = date.toLocaleDateString('ru-RU');


                    const timeKeyboard = Markup.inlineKeyboard([
                        [
                            Markup.button.callback('🌅 Утро (8:00-11:00)', 'interval_8_11'),
                            Markup.button.callback('🌇 День (13:00-16:00)', 'interval_13_16')
                        ],
                        [Markup.button.callback('⏱ Выбрать вручную', 'manual_time')],
                        [Markup.button.callback('❌ Отмена', 'stopscene')]
                    ]);


                    const s = await ctx.replyWithHTML(`⏰ <b>Выберите интервал доставки (от 7:00 до 18:00):</b>`,
                        timeKeyboard);
                    ctx.wizard.state.messageId = s.message_id;
                    ctx.wizard.state.timeSelectionStage = 'start';
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }

                if (ctx.callbackQuery.data.startsWith('interval_')) {
                    const [start, end] = ctx.callbackQuery.data.replace('interval_', '').split('_').map(Number);
                    ctx.wizard.state.timeInterval = `${start}:00 - ${end}:00`;
                    ctx.wizard.state.startHour = start;
                    ctx.wizard.state.endHour = end;

                    await ctx.deleteMessage(ctx.wizard.state.messageId);
                    const allBeton = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=?`, [(await getUser(ctx.from.id)).zavod, `Beton`])
                    const betonBut = allBeton.map(b =>
                        [{text: `${b.name} (${b.price_per_unit} руб/м³)`, callback_data:`type_${b.fid}`}]
                    );
                    betonBut.push([{ text: '❌ Отмена', callback_data: 'stopscene' }])
                    const s = await ctx.replyWithHTML(`📦 <b>Выберите нужную марку бетона:</b>`,
                        {
                            reply_markup: {
                                inline_keyboard: betonBut
                            }
                        }
                    );

                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }

                if (ctx.callbackQuery.data === 'manual_time') {
                    const hours = Array.from({length: 12}, (_, i) => i + 7);
                    const timeButtons = hours.map(h =>
                        Markup.button.callback(`${h}:00`, `time_${h}`)
                    );

                    await ctx.editMessageText(
                        `⏰ <b>Выберите начальное время (7:00-18:00):</b>`,
                        { parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    ...chunkArray(timeButtons, 4),
                                    [
                                        Markup.button.callback('◀️ Назад', 'time_back'),
                                        Markup.button.callback('❌ Отмена', 'stopscene')
                                    ]
                                ]
                            }
                        }
                    );

                    ctx.wizard.state.timeSelectionStage = 'start';
                    return;
                }

                if (ctx.callbackQuery.data.startsWith('time_')) {
                    const selectedHour = parseInt(ctx.callbackQuery.data.replace('time_', ''));

                    if (ctx.wizard.state.timeSelectionStage === 'start') {
                        ctx.wizard.state.startHour = selectedHour;
                        ctx.wizard.state.timeSelectionStage = 'end';

                        const minEnd = selectedHour + 1;
                        const maxEnd = Math.min(selectedHour + 3, 18);
                        const endHours = Array.from({length: maxEnd - minEnd + 1}, (_, i) => minEnd + i);

                        const endButtons = endHours.map(h =>
                            Markup.button.callback(`${h}:00`, `time_${h}`)
                        );

                        await ctx.editMessageText(
                            `⏰ Вы выбрали начало в ${selectedHour}:00\n` +
                            `<b>Выберите конечное время (до ${maxEnd}:00):</b>`,
                            { parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: [
                                        ...chunkArray(endButtons, 3),
                                        [
                                            Markup.button.callback('◀️ Назад', 'time_back'),
                                            Markup.button.callback('❌ Отмена', 'stopscene')
                                        ]
                                    ]
                                }
                            }
                        );
                    } else if (ctx.wizard.state.timeSelectionStage === 'end') {
                        const startHour = ctx.wizard.state.startHour;
                        const endHour = selectedHour;

                        if (endHour <= startHour || endHour > startHour + 3) {
                            await ctx.answerCbQuery('❌ Интервал должен быть от 1 до 3 часов');
                            return;
                        }

                        ctx.wizard.state.endHour = endHour;
                        ctx.wizard.state.timeInterval = `${startHour}:00 - ${endHour}:00`;

                        await ctx.deleteMessage(ctx.wizard.state.messageId);
                        const allBeton = await query(`SELECT * FROM nc WHERE zavod=? AND \`key\`=?`, [(await getUser(ctx.from.id)).zavod, `Beton`])
                        const betonBut = allBeton.map(b =>
                            [{text: `${b.name} (${b.price_per_unit} руб/м³)`, callback_data:`type_${b.fid}`}]
                        );
                        betonBut.push([{ text: '❌ Отмена', callback_data: 'stopscene' }])
                        const s = await ctx.replyWithHTML(`📦 <b>Выберите нужную марку бетона:</b>`,
                            {
                                reply_markup: {
                                    inline_keyboard: betonBut
                                }
                            }
                        );

                        ctx.wizard.state.messageId = s.message_id;
                        return ctx.wizard.next();
                    }
                }

                if (ctx.callbackQuery.data === 'time_back') {
                    const timeKeyboard = Markup.inlineKeyboard([
                        [
                            Markup.button.callback('🌅 Утро (8:00-11:00)', 'interval_8_11'),
                            Markup.button.callback('🌇 День (13:00-16:00)', 'interval_13_16')
                        ],
                        [Markup.button.callback('⏱ Выбрать вручную', 'manual_time')],
                        [Markup.button.callback('❌ Отмена', 'stopscene')]
                    ]);

                    await ctx.editMessageText(
                        `⏰ <b>Выберите временной интервал доставки:</b>`,
                        {parse_mode: 'HTML',
                            ...timeKeyboard}
                    );

                    delete ctx.wizard.state.timeSelectionStage;
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data.startsWith(`type_`)){
                    await ctx.deleteMessage(ctx.wizard.state.messageId)
                    ctx.wizard.state.betonType = parseInt(ctx.callbackQuery.data.split('_')[1]);
                    const s = await ctx.replyWithHTML(`⚖️ <b>Укажите объем/цену за кубометр со скидкой 
❗️Если цена по прайсу, напишите только объем❗️

(Пример 10/7000)</b>`, {reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
                    ctx.wizard.state.messageId = s.message_id;
                    return ctx.wizard.next();
                }
            }
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
            }
            await ctx.deleteMessage(ctx.wizard.state.messageId)
            await ctx.deleteMessage();
            const input = ctx.message.text.split('/');
            const price = await query(`SELECT * FROM nc WHERE fid=?`, [ctx.wizard.state.betonType]);
            if(input.length === 2 && !isNaN(input[0]) && !isNaN(input[1])){
                ctx.wizard.state.amount = input[0];
                ctx.wizard.state.userPrice = input[1];
                ctx.wizard.state.price = price[0].price_per_unit;
            }
            else{
                
                if(price.length > 0){
                    ctx.wizard.state.amount = ctx.message.text;
                    ctx.wizard.state.price = price[0].price_per_unit;
                    ctx.wizard.state.userPrice = price[0].price_per_unit;
                }
                else{
                    const s = await ctx.replyWithHTML(`❌ <b>Цена за кубометр не найдена в номенклатуре, введите свою. Укажите объем/цену за кубометр (Пример: 10/7000)</b>`);
                    ctx.wizard.state.messageId = s.message_id;
                    return;
                }
            }
            const s = await ctx.replyWithHTML(`<b>Дата: ${ctx.wizard.state.date} | ${ctx.wizard.state.timeInterval}
Обьем: ${ctx.wizard.state.amount} м³
Марка: ${(await query(`SELECT * FROM nc WHERE fid=?`,[ctx.wizard.state.betonType]))[0].name}
Цена: ${ctx.wizard.state.userPrice} руб/м³
Общая стоимость: ${ctx.wizard.state.amount * ctx.wizard.state.userPrice} руб</b>`, {reply_markup: {inline_keyboard: [[{text: 'Создать', callback_data: 'create'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
            ctx.wizard.state.messageId = s.message_id;
            return ctx.wizard.next();
        },
        async (ctx) => {
            if(ctx.callbackQuery){
                if(ctx.callbackQuery.data === `stopscene`){
                    ctx.deleteMessage();
                    return await ctx.scene.leave();
                }
                else if(ctx.callbackQuery.data === `create`){
                    await ctx.deleteMessage()
                    ctx.scene.leave();
                    const s = ctx.wizard.state
                    const user = await db.getUser(ctx.from.id)
                    const betont = (await query(`SELECT * FROM nc WHERE fid=?`,[s.betonType]))[0].name
                    const res = await createForm({
                        type: 3,
                        created_by: ctx.from.id,
                        date: `${s.date} | ${s.timeInterval}`,
                        betonType: betont,
                        betonAmount: parseInt(s.amount),
                        betonUserPrice: parseInt(s.userPrice),
                        betonPrice: parseInt(s.price),
                        zavod: -2,
                        status: 5,
                        pickup: user.zavod,
                        isPickup: 1
                    })
                    if(res){
                        ctx.replyWithHTML(`<b>Самовывоз успешно создан под номером #${res}. Он будет отображаться в: "🚛 Самовывоз"</b>`)
                    }
                }
            }
        }
    )

    return [enter_name,enter_company, create_pickup_form,create_ancet, search_by_id, search_by_phone, load_nc, driver_registration,worker_registration, add_car, manager_create, editmedia_form, edit_form, manager_shet,  search_ancet, booking_own_car, add_car_carrier, booking_own_car_carrier, offer_conditions, finish_form, attachToForm];
};

async function resultPrice(ctx) {
    let betonPrice = ctx.wizard.state.amount * ctx.wizard.state.price;
    const {price, amount, price_with_add} = ctx.wizard.state.delivery
    let deliveryPrice = 0;
    deliveryPrice = price * amount;

    let dops = ``;
    let price_dop = 0
    if(ctx.wizard.state.dop && ctx.wizard.state.dop.length > 0){
        if(!ctx.wizard.state.dop) {ctx.wizard.state.dop = []}
    for(const dop of ctx.wizard.state.dop){
        dops += `\n• ${dop.name} - ${dop.price_per_unit} руб.`
        price_dop += dop.price_per_unit;
    }
    }

    let enterPrice = betonPrice + deliveryPrice + price_dop;

    const s = await ctx.replyWithHTML(`<b>Общая цена за бетон: ${betonPrice} руб.
Общая цена за доставку: ${deliveryPrice} руб.
Допы: ${dops}

Общая стоимость допов: ${price_dop} руб.
        
💵 Общая стоимость входа: ${enterPrice} руб.</b>`, {reply_markup: {inline_keyboard: [[{text: 'Верно', callback_data: `enter:${enterPrice}`}],[{text: 'Ввести свою', callback_data: `enter:-1`}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
    ctx.wizard.state.messageId = s.message_id;
    return ctx.wizard.next();
}
async function exitPrice(ctx) {
       let betonPrice = ctx.wizard.state.amount * ctx.wizard.state.userPrice;
    const {price, amount, price_with_add} = ctx.wizard.state.delivery
    let deliveryPrice = 0;
    if(price_with_add !== null){
        deliveryPrice = price_with_add*amount
    }
    else{
    deliveryPrice = price * amount;
    }

    let dops = ``;
    let price_dop = 0
    if(!ctx.wizard.state.dop) {ctx.wizard.state.dop = []}
    for(const dop of ctx.wizard.state.dop){
        dops += `\n• ${dop.name} - ${dop.price_per_unit} руб.`
        price_dop += dop.price_per_unit;
    }

    let enterPrice = betonPrice + deliveryPrice + price_dop;

    const s = await ctx.replyWithHTML(`<b>Общая цена за бетон: ${betonPrice} руб.
Общая цена за доставку: ${deliveryPrice} руб.
Допы: ${dops}

Общая стоимость допов: ${price_dop} руб.
      
💵 Общая стоимость входа: ${ctx.wizard.state.enterPrice} руб.
💵 Общая стоимость выхода: ${enterPrice} руб.</b>`, {reply_markup: {inline_keyboard: [[{text: 'Верно', callback_data: `exit:${enterPrice}`}],[{text: 'Ввести свою', callback_data: `exit:-1`}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
    ctx.wizard.state.messageId = s.message_id;
    return ctx.wizard.next();
}
async function last(ctx) {
    const st = ctx.wizard.state
    let deliveryp = st.delivery.price;
    if(st.delivery.price_with_add){
        deliveryp = st.delivery.price_with_add
    }

    let dops = ``;
    let price_dop = 0
    for(const dop of st.dop){
        dops += `\n• ${dop.name} - ${dop.price_per_unit} руб.`
        price_dop += dop.price_per_unit;
    }
    let f;
    if(st.payForm === 2){
        f = `Предоплата ${st.payFormProcent}%`
    }

    const beton = (await query(`SELECT * FROM nc WHERE fid=?`,[st.betonType]))[0].name
    const s = await ctx.replyWithHTML(`📋 <b>Заявка составлена!

1) ${st.date} | ${st.timeInterval}
2) ${st.place}
3) ${st.phone}
4) ${beton}
5) Бетон ${st.amount}м³ * ${st.userPrice} (прайс ${st.price})
6) ${f || payForms[st.payForm]}
7) доставка: ${deliveryp} за ${st.delivery.amount} (прайс ${st.delivery.price})
8) Допы (${price_dop} руб.): ${dops}
9) Вход ${st.enterPrice} руб.
10) Выход ${st.exitPrice} руб.
11) ${st.com}
12) ${(await getUser(ctx.from.id)).real_name}</b>`, {reply_markup: {inline_keyboard: [[{text: '✅ Создать', callback_data: 'create_anc'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
    return s;
}
async function last_calc(ctx) {
    const st = ctx.wizard.state
    const an = ctx.wizard.state.an
    let deliveryp = st.delivery.price;
    if(st.delivery.price_with_add){
        deliveryp = st.delivery.price_with_add
    }

    let dops = ``;
    let price_dop = 0
    for(const dop of st.dop){
        dops += `\n• ${dop.name} - ${dop.price_per_unit} руб.`
        price_dop += dop.price_per_unit;
    }
    let f;
    if(st.payForm === 2){
        f = `Предоплата ${st.payFormProcent}%`
    }

    const beton = (await query(`SELECT * FROM nc WHERE fid=?`,[st.betonType]))[0].name
    const s = await ctx.replyWithHTML(`📋 <b>Заявка составлена!

1) ${an.date}
2) ${an.place}
3) ${an.phone}
4) ${beton}
5) Бетон ${st.amount}м³ * ${st.userPrice} (прайс ${st.price})
6) ${f || payForms[st.payForm]}
7) доставка: ${deliveryp} за ${st.delivery.amount} (прайс ${st.delivery.price})
8) Допы (${price_dop} руб.): ${dops}
9) Вход ${st.enterPrice} руб.
10) Выход ${st.exitPrice} руб.
11) ${an.com}
12) ${(await getUser(ctx.from.id)).real_name}</b>`, {reply_markup: {inline_keyboard: [[{text: '✅ Создать', callback_data: 'create_anc'}],[{text: '❌ Отмена', callback_data: 'stopscene'}]]}});
    return s;
}
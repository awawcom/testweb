const db = require('../database');

module.exports = {
    getOrdersForDriver: async (driver) => {
        const forms = await db.getFormsForDriver(driver);
        let text = `🚚 <b>Заявки в работе:</b>`
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `driver_form:${form.fid}`
            }]
        })
        return {
            text: text,
            but: but
        }
    },
    sendSos: async (form_id, type, ctx) => {

        const user = await db.getUser(ctx.from.id);
        const all = await db.getManagersAndLogists(user.zavod);
        let i = 0;
        const interval = setInterval(async ()=>{
            if(i === all.length){
                return clearInterval(interval);
            }
            const worker = all[i];

            ctx.telegram.sendMessage(worker.id, `<b>🚨 Водитель ${user.real_name} на машине ${(await db.getCarByDriver(user.id))?.name || 'Неизвестная машина'} по заявке #${form_id} нажал SOS!</b>
<b>Причина:</b> <i>${type}</i>`, {parse_mode: 'HTML'})

            i++
        }, 500)
    },
    getOrdersForDriverByStatus: async (driver, status) =>{
        const forms = await db.getFormsForDriverByStatus(driver, status);
        let text = `🚚 <b>Заявки:</b>`
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `driver_form:${form.fid}`
            }]
        })
        return {
            text: text,
            but: but
        }
    }
}
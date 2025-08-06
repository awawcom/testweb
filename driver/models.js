const db = require('../database');

module.exports = {
    openDriverCars: async (driver) => {
        const car = await db.findCarByDriver(driver);
        let text = `<b>Машина, за которой я работаю на данный момент:
        
${car?.name || 'У вас нет машины'}</b>`

        let but = [[{text: 'Поменять машину', callback_data: 'change_car_driver'}]]

        return {
            text: text,
            but: but
        }
    },
    getCarsForDriver: async (driver) => {
        const cars = await db.findCarsForDriver(driver) || [];
        let text = `<b>Машины, за которыми я могу работать:</b>`
        let but = []
        for(const car of cars){
            if(car.driver === driver){
                continue
            }
            else{
                but.push([{text: car.name, callback_data: `change_car:${car.fid}`}])
            }
        }
        return {
            text: text,
            but: but
        }
    },
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
        const all = await db.getManagersAndLogistsByZavodAndForm(user.zavod, parseInt(form_id));
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
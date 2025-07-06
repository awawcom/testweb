const db = require('../database');

module.exports = {
    getBookingForms: async (zavod) => {
        const forms = await db.getFormsToCarrier(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `carrier_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📋 Входящие запросы на бронирование</b>',
            keyboard: but
        }
    },
    getBookingFormsForAll: async () => {
        const forms = await db.getFormsToAllCarriers();
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `carrier_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📋 Входящие запросы на бронирование</b>',
            keyboard: but
        }
    },
    getBookingFormsForToday: async (zavod) => {
        const forms = await db.getFormsToCarrierToday(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `carrier_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📋 Входящие запросы на сегодня</b>',
            keyboard: but
        }
    },
    getCarsForEditForm: async (form_id, zavod) => {
        const cars = await db.getCarTypesByForm(form_id);
        const carrier_cars = await db.getCars(zavod);
        let but = carrier_cars.map(car => {
            const car_form =  cars.find(c => c.car_id === car.fid)
            if(car_form){
                return [{
                    text: `${car_form.car_name}`,
                    callback_data: `add_trip:${car_form.id}`
                }, {text: `${car_form.trips} рейс`, callback_data: 'none'}, {text: '✕', callback_data: `remove_car_from_form:${car_form.id}`}]
            }
            else{
                return [{
                    text: `${car.name}`,
                    callback_data: `add_car:${car.fid}:${form_id}`
                }]
            }
        })
        return {
            keyboard: but
        }
    },
    getFormsByStatus: async (status, zavod) => {
        const forms = await db.getFormsByStatusCarrier(status, zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `carrier_form:${form.fid}`
            }]
        })
        return {
            keyboard: but
        }
    },
    getBookingFormsForNextDay: async (zavod) => {
        const forms = await db.getFormsToCarrierNextDay(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `carrier_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📋 Входящие запросы на завтра</b>',
            keyboard: but
        }
    },
    getCars: async (zavod) => {
        const cars = await db.getCars(zavod);
        let but = cars.map(car => {
            return [{
                text: `#${car.fid} | ${car.name}`,
                callback_data: `carrier_car:${car.fid}`
            }]
        })
        but.push([{text: 'Добавить машину', callback_data: 'carrier_add_car'}])
        return {
            text: '<b>🚚 Мои машины</b>',
            keyboard: but
        }
    },
    removeCar: async (fid) => {
        const car = await db.getCar(fid);
        if(!car) return false;
        await db.removeCar(car.fid);
        return true;
    },
    rejectBooking: async (fid) => {
        const form = await db.getForm(fid);
        if(!form) return false;
        await db.rejectBooking(form.fid);
        return form;
    }
}
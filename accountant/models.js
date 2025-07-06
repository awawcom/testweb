const db = require('../database')
const data = require('../data')
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const fs = require('fs');

module.exports = {
    createArrayFormsByDate: async (date='', zavod) =>{
        let forms = await db.getFinishedFormsByDate(date, zavod);
        let pickups = await db.getFinishedPickupsByDate(date, zavod);
        let edited_forms = [];

        for(const form of forms){
            let temp = {
                'Статус заявки': data.ancetaStatus[form.status],
                'Номер заявки': form.fid,
                'Дата': String(form.date).substring(0,10),
                'Интервал у клиента': String(form.date).slice(11),
                'Адрес доставки': form.place,
                'Обьем': form.betonAmount,
                'Марка': form.betonType,
                'Цена бетон прайс': form.betonPrice,
                'Цена бетон выход': form.betonUserPrice,
                'Общая стоимость бетон': form.betonAmount*form.betonUserPrice,
                'Доставка стоимость прайс': form.deliveryPrice,
                'Доставка стоимость выход': form.deliveryPriceWithAdd,
                'Общая стоимость доставки/выход доставки': form.deliveryPriceWithAdd * form.deliveryAmount,
                'Допы стоимость прайс': form.dopPrice,
                'Допы': String(form.dopAll).split('\n').map(line => removePriceFromDops(line)).join('\n'),
                'Вход': form.enterPrice,
                'Выход': form.exitPrice,
                'Менеджер': form.real_name,
                'Завод отгрузки': await db.getZavodName(form.zavod)
            }
            
            const drivers_trips = await db.getAllTripsByForm(form.fid)
            let trips = [];
            let price = {
                'факт стоимость': 0,
                'ФАКТ ВХОД': 0
            }
            for(const trip of drivers_trips){
                trips.push({
                    'Номер машины': trip.carname || 'Неизвестная машина',
                    'Перевозчик': await db.getZavodNameByUser(trip.created_by),
                    'Водитель': (await db.getUser(trip.created_by)).real_name,
                    'Обьем на одну машину фактич обьем': trip.amount,
                    'Доставка стоимость факт':  trip.amount <= 10 ? form.deliveryPriceWithAdd*10 : form.deliveryPriceWithAdd * trip.amount,
                    'допы после отливки': trip.dops,
                    'Забрали деньги': trip.money_get,
                })

                price['факт стоимость'] += trip.money_get;
                price['ФАКТ ВХОД'] += trip.money_get;
            }
            if(trips.length > 0) temp = {...temp, ...trips[0]};
            if(trips.length > 1) trips.shift();
            
            edited_forms.push({
                //trips: trips,
                ...temp,
                ...price
            })
            trips.forEach((trip)=>{
                edited_forms.push(trip)
            })
        }
        for(const pickup of pickups){
            let temp = {
                'Статус заявки': `Самовывоз`,
                'Номер заявки': pickup.fid,
                'Дата': String(pickup.date).substring(0,10),
                'Интервал у клиента': String(pickup.date).slice(11),
                'Адрес доставки': pickup.place !== '-' ? pickup.place : 'Отсутствуют данные',
                'Обьем': pickup.betonAmount,
                'Марка': pickup.betonType,
                'Цена бетон прайс': pickup.betonPrice,
                'Цена бетон выход': pickup.betonUserPrice,
                'Общая стоимость бетон': pickup.betonAmount*pickup.betonUserPrice,
                'Доставка стоимость прайс': pickup.deliveryPrice !== -1 ? pickup.deliveryPrice : 'Отсутствуют данные',
                'Доставка стоимость выход': pickup.deliveryPriceWithAdd !== -1 ? pickup.deliveryPriceWithAdd : 'Отсутствуют данные',
                'Общая стоимость доставки/выход доставки': pickup.deliveryPriceWithAdd !== -1 ? pickup.deliveryPriceWithAdd * pickup.deliveryAmount : 'Отсутствуют данные',
                'Допы стоимость прайс': pickup.dopPrice !== -1 ? pickup.dopPrice : 'Отсутствуют данные',
                'Допы': pickup.dopAll !== '-' ? String(pickup.dopAll).split('\n').map(line => removePriceFromDops(line)).join('\n') : 'Отсутствуют данные',
                'Вход': pickup.enterPrice !== -1 ? pickup.enterPrice : 'Отсутствуют данные',
                'Выход': pickup.exitPrice !== -1 ? pickup.exitPrice : 'Отсутствуют данные',
                'Менеджер': pickup.real_name !== '-' ? pickup.real_name : 'Отсутствуют данные',
                'Завод отгрузки': await db.getZavodName(zavod)
            }
            
            const drivers_trips = await db.getAllTripsByForm(pickup.fid)
            let trips = [];
            let price = {
                'факт стоимость': 0,
                'ФАКТ ВХОД': 0
            }
            for(const trip of drivers_trips){
                trips.push({
                    'Номер машины': trip.carname || 'Неизвестная машина',
                    'Перевозчик': await db.getZavodNameByUser(trip.created_by),
                    'Водитель': (await db.getUser(trip.created_by)).real_name,
                    'Обьем на одну машину фактич обьем': trip.amount,
                    'Доставка стоимость факт':  trip.amount <= 10 ? pickup.deliveryPriceWithAdd*10 : pickup.deliveryPriceWithAdd * trip.amount,
                    'допы после отливки': trip.dops,
                    'Забрали деньги': trip.money_get,
                })

                price['факт стоимость'] += trip.money_get;
                price['ФАКТ ВХОД'] += trip.money_get;
            }
            if(trips.length > 0) temp = {...temp, ...trips[0]};
            if(trips.length > 1) trips.shift();
            
            edited_forms.push({
                //trips: trips,
                ...temp,
                ...price
            })
            trips.forEach((trip)=>{
                edited_forms.push(trip)
            })
        }
       return edited_forms;
    },
    createExcelTable: async (array, date, zavod) =>{
        const allHeaders = [...new Set(array.flatMap(Object.keys))];
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Заявки');

        worksheet.addRow(allHeaders);

        array.forEach(item => {
            const row = [];
            allHeaders.forEach(header => {
                row.push(item.hasOwnProperty(header) ? item[header] : '');
            });
            worksheet.addRow(row);
        });
        worksheet.columns = allHeaders.map(header => ({
            header,
            width: Math.max(15, header.length * 1.5)
        }));
        await workbook.xlsx.writeFile(`./reports/report_${date}_${zavod}.xlsx`)
        return `./reports/report_${date}_${zavod}.xlsx`
    },
    createArrayFormsShipments: async (zavod) =>{
        const forms = await db.getFormsToShipment(zavod);

        let edited_forms = [];
        for(const form of forms){
            edited_forms.push({
                'Статус': data.ancetaStatus[form.status],
                'Номер заявки': form.fid,
                'Дата': String(form.date).substring(0,10),
                'Интервал': String(form.date).slice(11),
                'Физ\\юр': form.entity !== -1 ? data.entity[form.entity] : await db.getUser(form.priv) ? data.entity[(await db.getUser(form.priv)).entity] : `Неизвестно`,
                'Номер тлф': form.phone,
                'Адрес': form.place,
                'Марка': form.betonType,
                'Обьем': form.betonAmount,
                'Цена Вход (за м3) (прайс)': form.betonPrice,
                'Цена выход (за м3)': form.betonUserPrice,
                'Доставка прайс за м3': form.deliveryPrice,
                'Доставка  выход за м3': form.deliveryPriceWithAdd,
                'Допы': String(form.dopAll).split('\n').map(line => removePriceFromDops(line)).join('\n'),
                'Стоимость допы': form.dopPrice,
                'Общая стоимость вход': form.enterPrice,
                'Общая стоимость выход': form.exitPrice,
                'Ответственный менеджер': form.real_name
            })
        }
        return edited_forms
    },
    getUPDFormsYesterday: async (zavod) => {
        const forms = await db.getUPDFormsYesterday(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `accountant_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📋 УПД за прошлый день</b>',
            keyboard: but
        }
    },
    getUPDForms: async (zavod) => {
        const forms = await db.getUPDForms(zavod);
        let but = forms.map(form => {
            return [{
                text: `#${form.fid} | ${form.betonType} ${form.betonAmount}м³`,
                callback_data: `accountant_form:${form.fid}`
            }]
        })
        return {
            text: '<b>📋 УПД общие</b>',
            keyboard: but
        }
    }
}

function removePriceFromDops(dopsString) {
    return dopsString.split('-')[0].trim();
  }
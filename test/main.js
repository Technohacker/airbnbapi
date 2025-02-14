require('dotenv').config()
process.env.NODE_ENV = 'test'
let abba = require('../build/main.js')
let log = require('../build/log.js')
let chai = require('chai')
let chaiAsPromised = require('chai-as-promised')
let nock = require('nock')
let _ = require('lodash')
let {assert, should, expect} = chai

chai.use(chaiAsPromised);

let dummyData = require('./dummydata.json')

// console.log(JSON.stringify(dummyData, null, 4))

const apiBaseUrl = 'https://api.airbnb.com'
const allBut = str =>  new RegExp('^(?!.*'+str+')')
const nockauth = _ => nock(apiBaseUrl).matchHeader('X-Airbnb-OAuth-Token', 'mockcorrecttoken')
const nockauthl = _ => nockauth().log(console.log)

describe('airbnbapi', () => {

    describe('#testAuth(token)', () => {
        it('should throw if a token is not passed', async () => {
            await expect(abba.testAuth()).to.be.rejected
        })

        // Mock endpoint: invalid token
        nock(apiBaseUrl)
        .matchHeader('X-Airbnb-OAuth-Token', allBut('mockcorrecttoken')) //anything but regex
        .post('/v2/batch', {operations:[]})
        .query(true)
        .reply(400)

        it('should return false for incorrect token', async () => {
            // console.log(await abba.testAuth('z'))
            await expect(abba.testAuth('z')).to.eventually.be.false
        })

        // Mock endpoint: valid token 'mockcorrecttoken'
        nockauth()
        .post('/v2/batch', {operations: []} )
        .query(true)
        .reply(200, {operations:[]})
        it('should return true for correct token', async () => {
            await expect(abba.testAuth('mockcorrecttoken')).to.eventually.be.true
        })
    })

    describe('#newAccessToken({username, password})', () => {
        // Mock endpoint: invalid info
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(abba.newAccessToken()).to.be.rejected
            await expect(abba.newAccessToken({password: 'asdf'})).to.be.rejected
            await expect(abba.newAccessToken({username: 'asdf'})).to.be.rejected
        })

        nock(apiBaseUrl)
        .post('/v1/authorize', {
            grant_type: 'password',
            username: 'wrong',
            password: 'wrong'
        })
        .query(true)
        .reply(400, {"error": "mock invalid username or password"})

        it('should return error object if login details are incorrect', () => {
            abba.newAccessToken({username: 'wrong', password: 'wrong'}).catch(e => expect(e).to.have.property('error'))
        })
        // Mock endpoint: valid info 'mockuser'. 'mockpass'
        nock(apiBaseUrl)
        .post('/v1/authorize', {
            grant_type: 'password',
            username: 'mockuser',
            password: 'mockpass'
        })
        .query(true)
        .reply(200, {access_token:'mocktoken'})

        it('should return a token obejct if the login details are correct', async () => {
            await expect(abba.newAccessToken({username: 'mockuser', password: 'mockpass' })).to.eventually.have.property('token')
        })
    })

    describe('#login({email, password})', () => {
        const testFunc = abba.login.bind(abba)
        // Mock endpoint: invalid info
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({password: 'asdf'})).to.be.rejected
            await expect(testFunc({email: 'asdf'})).to.be.rejected
        })

        nock(apiBaseUrl)
        .post('/v2/logins', {
            email: 'wrong',
            password: 'wrong'
        })
        .query(true)
        .reply(400, {"error": "mock invalid username or password"})

        it('should throw error object if login details are incorrect', async () => {
            testFunc({email: 'wrong', password: 'wrong'}).catch(e => expect(e).to.have.property('error'))
        })

        // Mock endpoint: valid info 'mockuser'. 'mockpass'
        nock(apiBaseUrl)
        .post('/v2/logins', {
            email: 'mockuser',
            password: 'mockpass'
        })
        .query(true)
        .reply(200, { login:{id:'mocktoken'}})

        it('should return a summary object if the login details are correct', async () => {
            await expect(testFunc({email: 'mockuser', password: 'mockpass' })).to.eventually.have.property('login')
        })
    })

    describe('#getPublicListingCalendar({id, month, year, count})', () => {
        const testFunc = abba.getPublicListingCalendar.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({month: '1', year: '2018', count: '1' })).to.be.rejected
        })
        nock(apiBaseUrl)
        .get('/v2/calendar_months')
        .query({
            currency: "JPY",
            key: "d306zoyjsyarp7ifhu67rjxn52tv0t20",
            listing_id: "1234",
            month: "1",
            year: "2018",
            count: "1",
            _format: "with_conditions"
        })
        .reply(200, { public:'calendar'})

        it('should return a calendar if arguments are correct', async () => {
            await expect(testFunc({id: 1234, month: '1', year: '2018', count: '1' })).to.eventually.have.property('public')
        })
    })

    describe('#getCalendar({token, id, startDate, endDate})', () => {
        const testFunc = abba.getCalendar.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({id:1234, startDate:'2017/11/01', endDate:'2017/12/01'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', startDate:'2017/11/01', endDate:'2017/12/01'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', id:1234, endDate:'2017/12/01'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', id:1234, startDate:'2017/11/01'})).to.be.rejected
        })
        nockauth()
        .get('/v2/calendar_days')
        .query({
            currency: "JPY",
            key: "d306zoyjsyarp7ifhu67rjxn52tv0t20",
            start_date: '2017-11-01',
            listing_id: 1234,
            _format: 'host_calendar',
            end_date: '2017-12-01'
        })
        .reply(200, {calendar_days: []})
        it('should return a array of calendar days if arguments are correct', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', id:1234, startDate:'2017-11-01', endDate:'2017-12-01'})).to.eventually.be.an('array')
        })
    })

    describe('#setPriceForDay({token, id, date, price, currency})', () => {
        const testFunc = abba.setPriceForDay.bind(abba)
        nockauth()
        .put('/v2/calendars/1234/2017-11-01', {
            daily_price: 123,
            demand_based_pricing_overridden: true,
            availability: 'available'
        })
        .query(true)
        .reply(200, {response: 'success'})
        it('should return result object for correct arguments', async () => {
            await expect(testFunc({token:'mockcorrecttoken', id:1234, date:'2017-11-01', price:123, currency:'USD'})).to.eventually.be.an('object')
        })
    })

    describe('#setAvailabilityForDay({token, id, date, availability}))', () => {
        const testFunc = abba.setAvailabilityForDay.bind(abba)
        nockauth()
        .put('/v2/calendars/1234/2017-11-01', {
            availability: 'available'
        })
        .query(true)
        .reply(200, {response: 'success'})
        it('should return result object for correct arguments', async () => {
            await expect(testFunc({token:'mockcorrecttoken', id:1234, date:'2017-11-01', availability:'available'})).to.eventually.be.an('object')
        })
    })

    describe('#setHouseManual({token, id, manual})', () => {
        const testFunc = abba.setHouseManual.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({id:1234, manual:'manual'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', manual:'manual'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', id:1234})).to.be.rejected
        })
        nockauth()
        .post('/v1/listings/1234/update', {
            listing: {house_manual: 'manual'}
        })
        .query(true)
        .reply(200, {response:'ok'})
        it('should return response object', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', id:1234, manual:'manual'})).to.eventually.be.an('object')
        })
    })

    describe('#getListingInfo(id)', () => {
        const testFunc = abba.getListingInfo.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            // expect(await testFunc({not_id:1234})).to.be.null
        })
        nock(apiBaseUrl)
        .get('/v1/listings/1234')
        .query(true)
        .reply(200, {listing:{}})

        it('should return a response object if arguments are correct', async () => {
            await expect(testFunc(1234)).to.eventually.have.property('listing')
        })
    })

    describe('#getListingInfoHost({token, id})', () => {
        const testFunc = abba.getListingInfoHost.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({id: 1234})).to.be.rejected
            await expect(testFunc({token: 'mockcorrecttoken'})).to.be.rejected
        })
        nockauth()
        .get('/v1/listings/1234')
        .query(true)
        .reply(200, {listing:{}})

        it('should return a response object if arguments are correct', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', id: 1234})).to.eventually.have.property('listing')
        })
    })

    describe('#getHostSummary(token)', () => {
        const testFunc = abba.getHostSummary.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
        })
        nockauth()
        .get('/v1/account/host_summary')
        .query(true)
        .reply(200, {active_listings:[{id: 6789}]})

        it('should return a response object if arguments are correct', async () => {
            await expect(testFunc('mockcorrecttoken')).to.eventually.have.property('active_listings')
        })
    })

    describe('#getOwnActiveListings(token)', () => {
        console.log(JSON.stringify(dummyData.getOwnActiveListings, null, 4))
        const testFunc = abba.getOwnActiveListings.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
        })
        nockauth()
        .get('/v1/account/host_summary')
        .query(true)
        .reply(200, {active_listings: dummyData.getOwnActiveListings})

        it('should return a response object if arguments are correct', async () => {
            await expect(testFunc('mockcorrecttoken')).to.eventually.be.an('array')
        })
    })

    describe('#getThread({token, id, currency})', () => {
        const testFunc = abba.getThread.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({token:'mockcorrecttoken'})).to.be.rejected
            await expect(testFunc({id:1234})).to.be.rejected
        })
        nockauth()
        .get('/v1/threads/1234')
        .query(true)
        .reply(200, {thread:{id: 1234}})

        it('should return a thread object if arguments are correct', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', id: 1234})).to.eventually.have.property('id')
        })
    })

    describe('#getThreadsBatch({token, ids, currency})', () => {
        const testFunc = abba.getThreadsBatch.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
        })
        it('should throw if token or ids is not passed', async () => {
            await expect(testFunc({id:1234})).to.be.rejected
            await expect(testFunc({token: 'mocktoken'})).to.be.rejected
        })
        nockauth()
        .post('/v2/batch', {
           operations: [
                {
                    method: 'GET',
                    path: '/threads/987',
                    query: {
                        _format: 'for_messaging_sync_with_posts'
                    }
                },
                {
                    method: 'GET',
                    path: '/threads/876',
                    query: {
                        _format: 'for_messaging_sync_with_posts'
                    }
                },
           ],
           _transaction: false
        })
        .query(true)
        .reply(200, {operations: [{id: 987}, {id: 876}]})
        it('should return type array if arguments are correct', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', ids:[987,876]})).to.eventually.be.an('array')
        })
    })

    describe('#getThreadsFull({token, offset, limit})', () => {
        const testFunc = abba.getThreadsFull.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({offset:2})).to.be.rejected
            await expect(testFunc({offset:2, limit:0})).to.be.rejected
        })
        nockauth()
        .get('/v2/threads')
        .query(q => q._format === 'for_messaging_sync_with_posts')
        .reply(200, {threads:[{id: 1234},{id: 2345},{id: 3456},{id: 5687},{id: 6789}]})

        it('should return a list(array) of threads if arguments are correct', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', offset:0, limit:10})).to.eventually.be.an('array')
        })
    })

    describe('#getThreads({token, offset, limit})', () => {
        const testFunc = abba.getThreads.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({offset:2})).to.be.rejected
            await expect(testFunc({offset:2, limit:0})).to.be.rejected
        })
        nockauth()
        .get('/v2/threads')
        .query(true)
        .reply(200, {threads:[{id: 1234},{id: 2345},{id: 3456},{id: 5687},{id: 6789}]})

        it('should return a list(array) of threads if arguments are correct', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', offset:0, limit:10})).to.eventually.be.an('array')
        })
    })

    describe('#createThread({token, id, checkin, checkout, guestNum, message})', () => {
        const testFunc = abba.createThread.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({id:1234, checkIn:'2017-01-01', checkOut:'2017-01-02', message:'asd'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', checkIn:'2017-01-01', checkOut:'2017-01-02', message:'asd'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', id:1234, checkOut:'2017-01-02', message:'asd'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', id:1234, checkIn:'2017-01-01', message:'asd'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', id:1234, checkIn:'2017-01-01', checkOut:'2017-01-02'})).to.be.rejected
        })
        nockauth()
        .post('/v1/threads/create', {
            listing_id:1234,
            number_of_guests:1,
            message:'hello!',
            checkin_date:'2017-01-01',
            checkout_date:'2017-01-02',
        })
        .query(true)
        .reply(200, {response:'ok'})
        it('should return response object', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', id:1234, checkIn:'2017-01-01', checkOut:'2017-01-02', message:'hello!'})).to.eventually.be.an('object')
        })
    })

    describe('getReservations({token, offset, limit}', async () => {
        const testFunc = abba.getReservations.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({offset:2})).to.be.rejected
            await expect(testFunc({offset:2, limit:0})).to.be.rejected
        })
        nockauth()
        .get('/v2/reservations')
        .query(q => q._format === 'for_mobile_host')
        .reply(200, {reservations:[{id: 1234},{id: 2345},{id: 3456},{id: 5687},{id: 6789}]})

        it('should return a list(array) of threads if arguments are correct', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', offset:0, limit:10})).to.eventually.be.an('array')
        })
    })

    describe('#getReservationsBatch({ token, ids, currency})', () => {
        const testFunc = abba.getReservationsBatch.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
        })
        it('should throw if token or ids is not passed', async () => {
            await expect(testFunc({id:1234})).to.be.rejected
            await expect(testFunc({token: 'mocktoken'})).to.be.rejected
        })
        nockauth()
        .post('/v2/batch', {
           operations: [
                {
                    method: 'GET',
                    path: '/reservations/987',
                    query: {
                        _format: 'for_mobile_host'
                    }
                },
                {
                    method: 'GET',
                    path: '/reservations/876',
                    query: {
                        _format: 'for_mobile_host'
                    }
                },
           ],
           _transaction: false
        })
        .query(true)
        .reply(200, {operations: [{id: 987}, {id: 876}]})
        it('should return type array if arguments are correct', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', ids:[987,876]})).to.eventually.be.an('array')
        })
    })

    describe('#getReservation({token, id, currency})', () => {
        const testFunc = abba.getReservation.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({token:'mockcorrecttoken'})).to.be.rejected
            await expect(testFunc({id:1234})).to.be.rejected
        })
        nockauth()
        .get('/v2/reservations/1234')
        .query(true)
        .reply(200, {reservation:{id: 1234}})

        it('should return a reservation object if arguments are correct', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', id: 1234})).to.eventually.have.property('id')
        })
    })

    describe('#sendMessage({ token, id, message })', () => {
        const testFunc = abba.sendMessage.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({id:1234, message:'hello'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', message:'hello'})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', id:1234})).to.be.rejected
        })
        nockauth()
        .post('/v2/messages', {
            thread_id:1234,
            message:'hello!'
        })
        .query(true)
        .reply(200, {response:'ok'})
        it('should return response object', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', id:1234, message:'hello!'})).to.eventually.be.an('object')
        })
    })

    describe('#sendPreApproval({token, thread_id, listing_id, message})', () => {
        const testFunc = abba.sendPreApproval.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({thread_id:987, listing_id:1234})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', listing_id:1234})).to.be.rejected
            await expect(testFunc({token: 'mocktoken', thread_id:987})).to.be.rejected
        })
        nockauth()
        .post('/v1/threads/987/update', {
            listing_id:1234,
            message:'',
            status:'preapproved'
        })
        .query(true)
        .reply(200, {response:'ok'})
        it('should return response object', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', listing_id:1234, thread_id:987})).to.eventually.be.an('object')
        })
    })

    describe('#sendReview({token, id, comments, private_feedback, cleanliness, communication, respect_house_rules, recommend})', () => {
        const testFunc = abba.sendReview.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc({id:456})).to.be.rejected
            await expect(testFunc({token: 'mocktoken'})).to.be.rejected
        })
        nockauth()
        .post('/v1/reviews/456/update', {
            comments: 'They were great guests!',
            private_feedback: 'Thank you for staying!',
            cleanliness: 5,
            communication: 5,
            respect_house_rules: 5,
            recommend: true
        })
        .query(true)
        .reply(200, {response:'ok'})
        it('should return response object', async () => {
            await expect(testFunc({token: 'mockcorrecttoken', id:456})).to.eventually.be.an('object')
        })
    })

    describe('#sendSpecialOffer({token, startDate, guests, listingId, nights, price, threadId, currency})', () => {
        const testFunc = abba.sendSpecialOffer.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            // expect(await testFunc({token:'mocktoken', startDate: '2017-01-01', guests:1, listingId:1234, nights:2, price:10000, threadId: 987})).to.be.null
            await expect(testFunc({startDate: '2017-01-01', guests:1, listingId:1234, nights:2, price:10000, threadId: 987})).to.be.rejected
            await expect(testFunc({token:'mocktoken', guests:1, listingId:1234, nights:2, price:10000, threadId: 987})).to.be.rejected
            await expect(testFunc({token:'mocktoken', startDate: '2017-01-01', listingId:1234, nights:2, price:10000, threadId: 987})).to.be.rejected
            await expect(testFunc({token:'mocktoken', startDate: '2017-01-01', guests:1, nights:2, price:10000, threadId: 987})).to.be.rejected
            await expect(testFunc({token:'mocktoken', startDate: '2017-01-01', guests:1, listingId:1234, price:10000, threadId: 987})).to.be.rejected
            await expect(testFunc({token:'mocktoken', startDate: '2017-01-01', guests:1, listingId:1234, nights:2, threadId: 987})).to.be.rejected
            await expect(testFunc({token:'mocktoken', startDate: '2017-01-01', guests:1, listingId:1234, nights:2, price:10000})).to.be.rejected
        })
        nockauth()
        .post('/v2/special_offers', {
            check_in: '2017-01-01',
            guests: 1,
            listing_id: 1234,
            nights: 2,
            price: 10000,
            thread_id: 987
        })
        .query(true)
        .reply(200, {response:'ok'})
        it('should return response object', async () => {
            await expect(testFunc({token:'mockcorrecttoken', startDate: '2017-01-01', guests:1, listingId:1234, nights:2, price:10000, threadId: 987})).to.eventually.be.an('object')
        })
    })

    describe('#getGuestInfo(id)', () => {
        const testFunc = abba.getGuestInfo.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
        })
        nock(apiBaseUrl)
        .get('/v2/users/1234')
        .query(true)
        .reply(200, {user:{id:1234}})

        it('should return a response object if arguments are correct', async () => {
            await expect(testFunc(1234)).to.eventually.have.property('id')
        })
    })

    describe('#getOwnUserInfo(token)', () => {
        const testFunc = abba.getOwnUserInfo.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
            await expect(testFunc('wrongtoken')).to.be.rejected
        })
        nockauth()
        .get('/v2/users/me')
        .query(true)
        .reply(200, {user:{id:1234}})

        it('should return a user info object if arguments are correct', async () => {
            await expect(testFunc('mockcorrecttoken')).to.eventually.have.property('id')
        })
    })

    describe('#listingSearch({location, offset, limit, language, currency})', () => {
        const testFunc = abba.listingSearch.bind(abba)

        it('should return a list of listings', async () => {
            nock(apiBaseUrl)
            .get('/v2/search_results')
            .twice()
            .query(true)
            .reply(200, {search_results:[{id:123},{id:456},{id:789}], metadata:{foo:'bar'}})
            await expect(testFunc()).to.eventually.have.property('search_results')
            await expect(testFunc({location: 'New York, United States', offset: 0, limit: 50, language: 'en', currency: 'USD'})).to.eventually.have.property('search_results')
        })
    })

    describe('#mGetOwnActiveListings(token)', () => {
        const testFunc = abba.mGetOwnActiveListingsFull.bind(abba)
        it('should throw if no arguments are passed or arguments are missing', async () => {
            await expect(testFunc()).to.be.rejected
        })
        nockauth()
        .get('/v1/account/host_summary')
        .query(true)
        .reply(200, {active_listings: dummyData.getOwnActiveListings})

        dummyData.getOwnActiveListings.forEach(listing => {
            nockauth()
            .get(`/v1/listings/${listing.listing.listing.id}`)
            .query(true)
            .reply(200, {listing:{}})
        })

        it('should return a response object if arguments are correct', async () => {
            await expect(testFunc('mockcorrecttoken')).to.eventually.be.an('array')
        })
    })
})

import log from './log.js'

export default {
    todo: 'make meta endpoints for combining data from multiple endpoints',
    async mGetOwnActiveListingsFull(token) {
        if (!token) {
            throw Error("Airbnbapi: Can't get an active listing list without a token")
        }
        const listings = await this.getOwnActiveListings(token)
        const fullListings = await Promise.all(
            listings.map(listing => {
                return this.getListingInfoHost({ token, id: listing.id })
            })
        )
        return fullListings
    }
}

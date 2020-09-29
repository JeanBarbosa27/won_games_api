'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

const axios = require('axios')
const slugify = require('slugify')

async function getGameInfo(slug) {
  const jsdom = require('jsdom')
  const { JSDOM } = jsdom
  const { data } = await axios.get(`https://www.gog.com/game/${slug}`)
  const dom = new JSDOM(data)

  const ratingElement = dom.window.document.querySelector('.age-restrictions__icon use')
  const descriptionElement = dom.window.document.querySelector('.description')

  return {
    rating: ratingElement
              ? ratingElement
                  .getAttribute('xlink:href')
                  .replace(/_/g, '')
                  .replace(/[^\w-]+/g, '')
              : 'BR0',
    short_description: descriptionElement.textContent.trim().slice(0, 160),
    description: descriptionElement.innerHTML
  }
}

async function findByName(entityName, registerName) {
  const entity = await strapi.services[entityName].findOne({ name: registerName })
  return entity;
}

async function handleRelationCreation(entityName, registerName) {
  const findRelation = await findByName(entityName, registerName)

  if(!findRelation) {
    await strapi.services[entityName].create({
      name: registerName,
      slug: slugify(registerName, { lower: true })
    })
  }
}

async function createManyToManyData(products) {
  const categories = {}
  const developers = {}
  const platforms = {}
  const publishers = {}

  products.forEach(
    ({ genres, developer, supportedOperatingSystems, publisher }) => {
      genres && genres.forEach(item => categories[item] = true)
      developer && Array.isArray(developer)
        ? developer.forEach(item => developers[item] = true)
        : developers[developer] = true
      supportedOperatingSystems
        && supportedOperatingSystems.forEach(item => platforms[item] = true)
      publishers[publisher] = true
    }
  )

  return Promise.all([
    ...Object.keys(categories).map(
      category => handleRelationCreation('category', category)
    ),
    ...Object.keys(developers).map(
      developer => handleRelationCreation('developer', developer)
    ),
    ...Object.keys(platforms).map(
      platform => handleRelationCreation('platform', platform)
    ),
    ...Object.keys(publishers).map(
      publisher => handleRelationCreation('publisher', publisher)
    ),
  ])
}

async function createGame(products) {
  Promise.all(
    products.map(async (product) => {
      const findGame = await findByName('game', product.title)

      if(!findGame) {
        console.log(`Creating game: ${product.title}...`)

        const game = strapi.services.game.create({
          name: product.title,
          slug: product.slug.replace(/_/g, '-'),
          price: product.price.amount,
          release_date: new Date(Number(
            product.globalReleaseDate * 1000
          )).toISOString(),
          categories: await Promise.all(
            product.genres.map(name => findByName('category', name))
          ),
          developers: [await findByName('developer', product.developer)],
          platforms: await Promise.all(
            product.supportedOperatingSystems.map(name => findByName('platform', name))
          ),
          publisher: await findByName('publisher', product.publisher),
          ...(await getGameInfo(product.slug))
        })

        return game
      }
    })
  )
}

module.exports = {
  populate: async (params) => {
    console.log('Executing game service...')

    const gogApiUrl = `https://www.gog.com/games/ajax/filtered?mediaType=game&page=1&sort=popularity`

    const { data : { products } } = await axios.get(gogApiUrl)

    console.log(await getGameInfo(products[1].slug))

    await createManyToManyData([ products[2], products[3] ])
    await createGame([ products[2], products[3] ])
    console.log('Game service done!');

  }
};
